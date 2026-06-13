import { Module, Global, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './scheme.js';

export const DB_CONNECTION = Symbol('DB_CONNECTION');
export const PG_CONNECTION = Symbol('PG_CONNECTION');

@Global()
@Module({
    imports: [ConfigModule],
    providers: [
        {
            provide: PG_CONNECTION,
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => {
                const dbUrl = configService.getOrThrow<string>('DATABASE_URL');
                return postgres(dbUrl as string);
            },
        },
        {
            provide: DB_CONNECTION,
            inject: [PG_CONNECTION],
            useFactory: (connection: postgres.Sql<{}>) => {
                return drizzle(connection, { schema });
            },
        },
    ],
    exports: [DB_CONNECTION],
})
export class DatabaseModule implements OnModuleDestroy {
    constructor(@Inject(PG_CONNECTION) private readonly connection: postgres.Sql<{}>) {}

    async onModuleDestroy() {
        if (this.connection) {
            await this.connection.end();
        }
    }
}