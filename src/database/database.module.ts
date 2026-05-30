import { Module, Global } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './scheme.js';
import * as dotenv from 'dotenv';

dotenv.config();

export const DB_CONNECTION = 'DB_CONNECTION';

@Global()
@Module({
    providers: [
        {
            provide: DB_CONNECTION,
            useFactory: async () => {
                const queryClient = postgres(process.env.DATABASE_URL as string);
                return drizzle(queryClient, { schema });
            },
        },
    ],
    exports: [DB_CONNECTION],
})
export class DatabaseModule {}