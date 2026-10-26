import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { DB_CONNECTION } from '../database/database.module';
import type { Db } from '../database/database.types';
import * as schema from '../database/scheme';
import { ACCENT_PALETTE } from './catalog';
import { equippedFromRows, type EquippedState } from './equipment';

const DEFAULT_ACCENT_HEX = ACCENT_PALETTE.hot_pink;
const VINE_BOOM_KEY = 'vine_boom';

export interface PublicCosmetics {
  accent: string;
  background: string | null;
  title: string | null;
  nameColor: string | null;
  nameIcon: string | null;
  quoteStyle: string | null;
  nyanCat: boolean;
  verified: boolean;
  stickers: [string | null, string | null, string | null];
  vineBoom: boolean;
}

export interface AuthorCosmetics {
  nameColor: string | null;
  nameIcon: string | null;
  quoteStyle: string | null;
  vineBoom: boolean;
}

const paletteHex = (itemKey: string | null, prefix: string): string | null => {
  if (!itemKey?.startsWith(prefix)) return null;
  return ACCENT_PALETTE[itemKey.slice(prefix.length)] ?? null;
};

export function toPublicCosmetics(
  equipped: EquippedState,
  ownsVineBoom = false,
): PublicCosmetics {
  return {
    accent: paletteHex(equipped.accent, 'accent_') ?? DEFAULT_ACCENT_HEX,
    background: equipped.background,
    title: equipped.title,
    nameColor: paletteHex(equipped.nameColor, 'namecolor_'),
    nameIcon: equipped.nameIcon,
    quoteStyle: equipped.quoteStyle,
    nyanCat: equipped.nyanCat,
    verified: equipped.verified,
    stickers: equipped.stickers,
    vineBoom: ownsVineBoom,
  };
}

export function toAuthorCosmetics(cosmetics: PublicCosmetics): AuthorCosmetics {
  return {
    nameColor: cosmetics.nameColor,
    nameIcon: cosmetics.nameIcon,
    quoteStyle: cosmetics.quoteStyle,
    vineBoom: cosmetics.vineBoom,
  };
}

export const DEFAULT_PUBLIC_COSMETICS: PublicCosmetics = toPublicCosmetics(
  equippedFromRows([]),
);

@Injectable()
export class CosmeticsService {
  constructor(@Inject(DB_CONNECTION) private readonly db: Db) {}

  // One query for any number of users. Every requested id gets an entry.
  async forUsers(userIds: string[]): Promise<Map<string, PublicCosmetics>> {
    const uniqueIds = [...new Set(userIds)];
    const result = new Map<string, PublicCosmetics>();
    if (uniqueIds.length === 0) return result;

    const [rows, vineBoomOwners] = await Promise.all([
      this.db
        .select({
          userId: schema.userEquipped.userId,
          slot: schema.userEquipped.slot,
          itemKey: schema.userEquipped.itemKey,
        })
        .from(schema.userEquipped)
        .where(inArray(schema.userEquipped.userId, uniqueIds)),
      this.db
        .select({ userId: schema.userInventory.userId })
        .from(schema.userInventory)
        .where(
          and(
            inArray(schema.userInventory.userId, uniqueIds),
            eq(schema.userInventory.itemKey, VINE_BOOM_KEY),
          ),
        ),
    ]);
    const vineBoomUsers = new Set(vineBoomOwners.map((row) => row.userId));

    const rowsByUser = new Map<string, typeof rows>();
    for (const row of rows) {
      const bucket = rowsByUser.get(row.userId) ?? [];
      bucket.push(row);
      rowsByUser.set(row.userId, bucket);
    }
    for (const userId of uniqueIds) {
      result.set(
        userId,
        toPublicCosmetics(
          equippedFromRows(rowsByUser.get(userId) ?? []),
          vineBoomUsers.has(userId),
        ),
      );
    }
    return result;
  }
}
