import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type {
  PostgresJsDatabase,
  PostgresJsTransaction,
} from 'drizzle-orm/postgres-js';
import * as schema from './scheme';

export type Db = PostgresJsDatabase<typeof schema>;
export type DbOrTx =
  | Db
  | PostgresJsTransaction<
      typeof schema,
      ExtractTablesWithRelations<typeof schema>
    >;
