import { sql } from 'drizzle-orm';
import type { Db, DbOrTx } from '../database/database.types';
import * as schema from '../database/scheme';
import { utcDay } from './utc-day';

// One aura snapshot per user per UTC day. Call it with the aura value just
// written and the tx that wrote it, so the snapshot commits with the change.
export async function recordAuraSnapshot(
  tx: DbOrTx | Db,
  userId: string,
  aura: number,
): Promise<void> {
  await tx
    .insert(schema.auraHistory)
    .values({ userId, day: utcDay(), aura })
    .onConflictDoUpdate({
      target: [schema.auraHistory.userId, schema.auraHistory.day],
      set: { aura: sql`excluded.aura` },
    });
}
