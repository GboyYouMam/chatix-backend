import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, gt, gte, sql } from 'drizzle-orm';
import { DB_CONNECTION } from '../database/database.module';
import type { Db, DbOrTx } from '../database/database.types';
import * as schema from '../database/scheme';
import type { UseItemDto } from './dto/use-item.dto';
import type { InventoryEntry } from './shop.service';
import { RealtimeService } from '../realtime/realtime.service';
import { toPublicMessage } from '../messages/message.serializer';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

export const USABLE_ITEM_KEYS = [
  'clown_stamp',
  'rename_curse',
  'aura_tax',
  'spotlight',
  'room_boost',
  'fight_insurance',
  'debt_forgiveness',
] as const;
export type UsableItemKey = (typeof USABLE_ITEM_KEYS)[number];

const PROFILE_EFFECT_DURATION_MS: Record<
  'clown_stamp' | 'rename_curse',
  number
> = {
  clown_stamp: 24 * HOUR_MS,
  rename_curse: HOUR_MS,
};
const AURA_TAX_MS = 24 * HOUR_MS;
const ROOM_BOOST_MS = HOUR_MS;
const SPOTLIGHT_MS = 10 * MINUTE_MS;
const DEBT_FORGIVENESS_AMOUNT = 100;

export interface UseResult {
  inventory: InventoryEntry[];
}

// A room-facing effect that posts a system line and a roomNotice after commit.
interface RoomNotice {
  roomId: string;
  kind: 'aura_tax' | 'room_boost' | 'spotlight';
  text: string;
  messageId: string;
}

@Injectable()
export class ConsumablesService {
  constructor(
    @Inject(DB_CONNECTION) private readonly db: Db,
    private readonly realtime: RealtimeService,
  ) {}

  // Every branch runs in one transaction: the inventory decrement (conditional
  // on quantity >= 1) and the effect commit or roll back together, so two
  // concurrent uses of the last item cannot both apply. Room notices are
  // emitted only after the commit.
  async use(userId: string, dto: UseItemDto): Promise<UseResult> {
    const key = dto.itemKey as UsableItemKey;
    const { inventory, notice } = await this.db.transaction(async (tx) => {
      let notice: RoomNotice | undefined;
      switch (key) {
        case 'clown_stamp':
        case 'rename_curse':
          await this.applyProfileEffect(tx, userId, key, dto.targetUserId);
          break;
        case 'aura_tax':
        case 'room_boost':
          notice = await this.boostRoom(tx, userId, key, dto.roomId);
          break;
        case 'spotlight':
          notice = await this.spotlightMessage(tx, userId, dto.messageId);
          break;
        case 'fight_insurance':
          await this.armInsurance(tx, userId);
          break;
        case 'debt_forgiveness':
          await this.consume(tx, userId, key);
          await tx
            .update(schema.users)
            .set({
              debt: sql`${schema.users.debt} - ${DEBT_FORGIVENESS_AMOUNT}`,
            })
            .where(eq(schema.users.id, userId));
          break;
      }
      return { inventory: await this.listInventory(tx, userId), notice };
    });
    if (notice) await this.announce(notice);
    return { inventory };
  }

  private async announce(notice: RoomNotice) {
    const message = await this.db.query.messages.findFirst({
      where: eq(schema.messages.id, notice.messageId),
      with: {
        author: {
          columns: {
            id: true,
            username: true,
            pfp_url: true,
            forcedTitle: true,
            isMogged: true,
            featuredAchievements: true,
          },
        },
        attachments: true,
      },
    });
    if (message) {
      this.realtime.emitToRoom(
        notice.roomId,
        'newMessage',
        toPublicMessage(message, null),
      );
    }
    this.realtime.emitToRoom(notice.roomId, 'roomNotice', {
      roomId: notice.roomId,
      text: notice.text,
      kind: notice.kind,
    });
  }

  private async insertSystemMessage(
    tx: DbOrTx,
    roomId: string,
    actorId: string,
    text: string,
  ): Promise<string> {
    const [row] = await tx
      .insert(schema.messages)
      .values({ roomId, authorId: actorId, cipherText: text, kind: 'system' })
      .returning({ id: schema.messages.id });
    return row.id;
  }

  private async actorName(tx: DbOrTx, actorId: string): Promise<string> {
    const [actor] = await tx
      .select({ username: schema.users.username })
      .from(schema.users)
      .where(eq(schema.users.id, actorId));
    return actor?.username ?? 'someone';
  }

  private async applyProfileEffect(
    tx: DbOrTx,
    actorId: string,
    kind: 'clown_stamp' | 'rename_curse',
    targetUserId: string | undefined,
  ) {
    if (!targetUserId) {
      throw new BadRequestException({
        code: 'TARGET_REQUIRED',
        message: 'who are we cursing? pick a chud.',
      });
    }
    if (targetUserId === actorId) {
      throw new BadRequestException({
        code: 'SELF_TARGET',
        message: 'not on yourself, chud.',
      });
    }
    // Locking the target row serialises every effect applied to that target.
    const [target] = await tx
      .select({ id: schema.users.id, role: schema.users.role })
      .from(schema.users)
      .where(eq(schema.users.id, targetUserId))
      .for('update');
    if (!target) throw new NotFoundException('no such chud.');
    if (target.role === 'admin') {
      throw new ForbiddenException({
        code: 'ADMIN_TARGET',
        message: 'admins are untouchable. nice try.',
      });
    }

    const [active] = await tx
      .select({ id: schema.profileEffects.id })
      .from(schema.profileEffects)
      .where(
        and(
          eq(schema.profileEffects.targetId, targetUserId),
          eq(schema.profileEffects.kind, kind),
          gt(schema.profileEffects.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (active) {
      throw new ConflictException({
        code: 'ALREADY_CURSED',
        message: 'already cursed. let it breathe.',
      });
    }

    await this.consume(tx, actorId, kind);
    await tx.insert(schema.profileEffects).values({
      targetId: targetUserId,
      kind,
      appliedById: actorId,
      expiresAt: new Date(Date.now() + PROFILE_EFFECT_DURATION_MS[kind]),
    });
  }

  // Aura tax and room boost stack onto the current end time when still active.
  private async boostRoom(
    tx: DbOrTx,
    actorId: string,
    kind: 'aura_tax' | 'room_boost',
    roomId: string | undefined,
  ): Promise<RoomNotice> {
    if (!roomId) {
      throw new BadRequestException({
        code: 'ROOM_REQUIRED',
        message: 'pick a room, chud.',
      });
    }
    const [room] = await tx
      .select({
        creatorId: schema.rooms.creatorId,
        status: schema.rooms.status,
        sponsoredUntil: schema.rooms.sponsoredUntil,
        boostedUntil: schema.rooms.boostedUntil,
      })
      .from(schema.rooms)
      .where(eq(schema.rooms.id, roomId))
      .for('update');
    if (!room) throw new NotFoundException('no such room. it got cooked.');
    if (room.creatorId !== actorId) {
      throw new ForbiddenException({
        code: 'NOT_YOUR_ROOM',
        message: 'that room is not yours. nice try.',
      });
    }
    if (room.status !== 'active') {
      throw new BadRequestException({
        code: 'ROOM_NOT_LIVE',
        message: 'room is not live. nobody can see your ad.',
      });
    }

    await this.consume(tx, actorId, kind);
    const now = Date.now();
    const name = await this.actorName(tx, actorId);
    if (kind === 'aura_tax') {
      const from = Math.max(now, room.sponsoredUntil?.getTime() ?? 0);
      await tx
        .update(schema.rooms)
        .set({
          sponsoredById: actorId,
          sponsoredUntil: new Date(from + AURA_TAX_MS),
        })
        .where(eq(schema.rooms.id, roomId));
    } else {
      const from = Math.max(now, room.boostedUntil?.getTime() ?? 0);
      await tx
        .update(schema.rooms)
        .set({ boostedUntil: new Date(from + ROOM_BOOST_MS) })
        .where(eq(schema.rooms.id, roomId));
    }
    const text =
      kind === 'aura_tax'
        ? `@${name} paid the aura tax. bow.`
        : `@${name} boosted this room. promoted. lol.`;
    return {
      roomId,
      kind,
      text,
      messageId: await this.insertSystemMessage(tx, roomId, actorId, text),
    };
  }

  private async spotlightMessage(
    tx: DbOrTx,
    actorId: string,
    messageId: string | undefined,
  ): Promise<RoomNotice> {
    if (!messageId) {
      throw new BadRequestException({
        code: 'MESSAGE_REQUIRED',
        message: 'pick a message, chud.',
      });
    }
    const [message] = await tx
      .select({
        id: schema.messages.id,
        roomId: schema.messages.roomId,
        authorId: schema.messages.authorId,
        isDeleted: schema.messages.isDeleted,
      })
      .from(schema.messages)
      .where(eq(schema.messages.id, messageId));
    if (!message) {
      throw new NotFoundException('no such message. it got cooked.');
    }
    if (message.authorId !== actorId) {
      throw new ForbiddenException({
        code: 'NOT_YOUR_MESSAGE',
        message: 'that is not your yap. nice try.',
      });
    }
    if (message.isDeleted) {
      throw new BadRequestException({
        code: 'MESSAGE_DELETED',
        message: 'deleted yaps cannot be spotlit.',
      });
    }
    const [room] = await tx
      .select({ status: schema.rooms.status })
      .from(schema.rooms)
      .where(eq(schema.rooms.id, message.roomId))
      .for('update');
    if (room?.status !== 'active') {
      throw new BadRequestException({
        code: 'ROOM_NOT_LIVE',
        message: 'room is not live. nobody can see your ad.',
      });
    }

    await this.consume(tx, actorId, 'spotlight');
    await tx
      .update(schema.rooms)
      .set({
        spotlightMessageId: message.id,
        spotlightUntil: new Date(Date.now() + SPOTLIGHT_MS),
      })
      .where(eq(schema.rooms.id, message.roomId));
    const name = await this.actorName(tx, actorId);
    const text = `@${name} spotlit a yap. look up.`;
    return {
      roomId: message.roomId,
      kind: 'spotlight',
      text,
      messageId: await this.insertSystemMessage(
        tx,
        message.roomId,
        actorId,
        text,
      ),
    };
  }

  private async armInsurance(tx: DbOrTx, userId: string) {
    const [user] = await tx
      .select({ armed: schema.users.fightInsuranceArmed })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .for('update');
    if (user?.armed) {
      throw new ConflictException({
        code: 'ALREADY_ARMED',
        message: 'already insured. calm down.',
      });
    }
    await this.consume(tx, userId, 'fight_insurance');
    await tx
      .update(schema.users)
      .set({ fightInsuranceArmed: true })
      .where(eq(schema.users.id, userId));
  }

  // Conditional decrement: fails unless the user holds at least one.
  private async consume(tx: DbOrTx, userId: string, itemKey: string) {
    const [row] = await tx
      .update(schema.userInventory)
      .set({ quantity: sql`${schema.userInventory.quantity} - 1` })
      .where(
        and(
          eq(schema.userInventory.userId, userId),
          eq(schema.userInventory.itemKey, itemKey),
          gte(schema.userInventory.quantity, 1),
        ),
      )
      .returning({ quantity: schema.userInventory.quantity });
    if (!row) {
      throw new ForbiddenException({
        code: 'NOT_OWNED',
        message: 'u dont own that. nice try.',
      });
    }
    if (row.quantity === 0) {
      await tx
        .delete(schema.userInventory)
        .where(
          and(
            eq(schema.userInventory.userId, userId),
            eq(schema.userInventory.itemKey, itemKey),
            eq(schema.userInventory.quantity, 0),
          ),
        );
    }
  }

  private async listInventory(
    tx: DbOrTx,
    userId: string,
  ): Promise<InventoryEntry[]> {
    return tx
      .select({
        itemKey: schema.userInventory.itemKey,
        quantity: schema.userInventory.quantity,
      })
      .from(schema.userInventory)
      .where(eq(schema.userInventory.userId, userId));
  }
}
