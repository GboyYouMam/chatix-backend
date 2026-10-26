import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, inArray } from 'drizzle-orm';
import { DB_CONNECTION } from '../database/database.module';
import type { Db } from '../database/database.types';
import * as schema from '../database/scheme';

export const PROFILE_EFFECT_KINDS = ['clown_stamp', 'rename_curse'] as const;
export type ProfileEffectKind = (typeof PROFILE_EFFECT_KINDS)[number];

export interface ActiveProfileEffect {
  kind: ProfileEffectKind;
  expiresAt: Date;
  appliedBy: { username: string } | null;
}

@Injectable()
export class ProfileEffectsService {
  constructor(@Inject(DB_CONNECTION) private readonly db: Db) {}

  // One query for any number of users. Every requested id gets an entry.
  async forUsers(
    userIds: string[],
  ): Promise<Map<string, ActiveProfileEffect[]>> {
    const uniqueIds = [...new Set(userIds)];
    const result = new Map<string, ActiveProfileEffect[]>();
    for (const id of uniqueIds) result.set(id, []);
    if (uniqueIds.length === 0) return result;

    const rows = await this.db
      .select({
        targetId: schema.profileEffects.targetId,
        kind: schema.profileEffects.kind,
        expiresAt: schema.profileEffects.expiresAt,
        appliedByUsername: schema.users.username,
      })
      .from(schema.profileEffects)
      .leftJoin(
        schema.users,
        eq(schema.users.id, schema.profileEffects.appliedById),
      )
      .where(
        and(
          inArray(schema.profileEffects.targetId, uniqueIds),
          gt(schema.profileEffects.expiresAt, new Date()),
        ),
      );

    for (const row of rows) {
      result.get(row.targetId)?.push({
        kind: row.kind as ProfileEffectKind,
        expiresAt: row.expiresAt,
        appliedBy: row.appliedByUsername
          ? { username: row.appliedByUsername }
          : null,
      });
    }
    return result;
  }
}

export function isRenameCursed(effects: ActiveProfileEffect[]): boolean {
  return effects.some((effect) => effect.kind === 'rename_curse');
}
