import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, gte, sql } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import { DB_CONNECTION } from '../database/database.module';
import type { Db, DbOrTx } from '../database/database.types';
import * as schema from '../database/scheme';
import {
  findShopItem,
  MYSTERY_SOAP_ODDS,
  MYSTERY_SOAP_POOLS,
  SHOP_ITEMS,
  type ShopItem,
} from './catalog';
import { equippedFromRows } from './equipment';

export interface InventoryEntry {
  itemKey: string;
  quantity: number;
}

export interface PurchaseResult {
  aura: number;
  inventory: InventoryEntry[];
  granted?: string;
  refunded?: number;
}

const MYSTERY_SOAP_KEY = 'mystery_soap';
const SOAP_DUPE_REFUND_RATIO = 0.5;

@Injectable()
export class ShopService {
  constructor(@Inject(DB_CONNECTION) private readonly db: Db) {}

  listCatalog(): readonly ShopItem[] {
    return SHOP_ITEMS;
  }

  async getMe(userId: string) {
    const [user] = await this.db
      .select({ aura: schema.users.aura })
      .from(schema.users)
      .where(eq(schema.users.id, userId));
    if (!user) throw new NotFoundException('no such chud. try logging in.');
    const [inventory, equippedRows] = await Promise.all([
      this.listInventory(this.db, userId),
      this.db
        .select({
          slot: schema.userEquipped.slot,
          itemKey: schema.userEquipped.itemKey,
        })
        .from(schema.userEquipped)
        .where(eq(schema.userEquipped.userId, userId)),
    ]);
    return {
      aura: user.aura,
      inventory,
      equipped: equippedFromRows(equippedRows),
    };
  }

  async purchase(userId: string, itemKey: string): Promise<PurchaseResult> {
    const item = findShopItem(itemKey);
    if (!item) {
      throw new BadRequestException({
        code: 'UNKNOWN_ITEM',
        message: 'no such item. nice try.',
      });
    }
    return this.db.transaction(async (tx) => {
      // Every purchase by this user takes the user row lock first, so the
      // ownership and requirement checks below cannot race a concurrent buy.
      await tx
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .for('update');

      if (item.requires) {
        const [unlocked] = await tx
          .select({ key: schema.userAchievements.key })
          .from(schema.userAchievements)
          .where(
            and(
              eq(schema.userAchievements.userId, userId),
              eq(schema.userAchievements.key, item.requires),
            ),
          )
          .limit(1);
        if (!unlocked) {
          throw new ForbiddenException({
            code: 'LOCKED',
            message: 'locked. find it first, chud.',
          });
        }
      }

      if (
        item.kind === 'permanent' &&
        (await this.owns(tx, userId, item.key))
      ) {
        throw new ConflictException({
          code: 'ALREADY_OWNED',
          message: 'u already got that. stop hoarding.',
        });
      }

      // Single conditional update: no buying on credit.
      const [charged] = await tx
        .update(schema.users)
        .set({ aura: sql`${schema.users.aura} - ${item.price}` })
        .where(
          and(eq(schema.users.id, userId), gte(schema.users.aura, item.price)),
        )
        .returning({ aura: schema.users.aura });
      if (!charged) {
        throw new BadRequestException({
          code: 'BROKE',
          message: 'u broke. go farm.',
        });
      }

      if (item.key === MYSTERY_SOAP_KEY) {
        return this.openMysterySoap(tx, userId, item, charged.aura);
      }

      await this.grant(tx, userId, item.key);
      await this.recordPurchase(tx, userId, item);
      return {
        aura: charged.aura,
        inventory: await this.listInventory(tx, userId),
      };
    });
  }

  private async openMysterySoap(
    tx: DbOrTx,
    userId: string,
    soap: ShopItem,
    auraAfterCharge: number,
  ): Promise<PurchaseResult> {
    const granted = rollMysterySoap();
    await this.recordPurchase(tx, userId, soap);

    const grantedItem = findShopItem(granted);
    const isDupe =
      grantedItem?.kind === 'permanent' &&
      (await this.owns(tx, userId, granted));

    if (isDupe) {
      const refund = Math.floor(soap.price * SOAP_DUPE_REFUND_RATIO);
      const [refunded] = await tx
        .update(schema.users)
        .set({ aura: sql`${schema.users.aura} + ${refund}` })
        .where(eq(schema.users.id, userId))
        .returning({ aura: schema.users.aura });
      return {
        aura: refunded.aura,
        inventory: await this.listInventory(tx, userId),
        granted,
        refunded: refund,
      };
    }

    await this.grant(tx, userId, granted);
    return {
      aura: auraAfterCharge,
      inventory: await this.listInventory(tx, userId),
      granted,
    };
  }

  private async owns(tx: DbOrTx, userId: string, itemKey: string) {
    const [row] = await tx
      .select({ itemKey: schema.userInventory.itemKey })
      .from(schema.userInventory)
      .where(
        and(
          eq(schema.userInventory.userId, userId),
          eq(schema.userInventory.itemKey, itemKey),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  // Permanent items are only ever granted after the ownership check under the
  // user row lock, so the upsert only increments quantity for consumables.
  private async grant(tx: DbOrTx, userId: string, itemKey: string) {
    await tx
      .insert(schema.userInventory)
      .values({ userId, itemKey, quantity: 1 })
      .onConflictDoUpdate({
        target: [schema.userInventory.userId, schema.userInventory.itemKey],
        set: { quantity: sql`${schema.userInventory.quantity} + 1` },
      });
  }

  private async recordPurchase(tx: DbOrTx, userId: string, item: ShopItem) {
    await tx.insert(schema.shopPurchases).values({
      userId,
      itemKey: item.key,
      price: item.price,
    });
  }

  private async listInventory(
    tx: DbOrTx | Db,
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

// Exported for tests: rolls a mystery soap outcome using the 70/25/5 odds.
export function rollMysterySoap(): string {
  const roll = randomInt(100);
  const { common, rare } = MYSTERY_SOAP_ODDS;
  const pool =
    roll < common
      ? MYSTERY_SOAP_POOLS.common
      : roll < common + rare
        ? MYSTERY_SOAP_POOLS.rare
        : MYSTERY_SOAP_POOLS.legendary;
  return pool[randomInt(pool.length)];
}
