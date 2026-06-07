import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB_CONNECTION } from "../database/database.module";
import * as scheme from '../database/scheme';
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";

@Injectable()
export class UsersRepository {
    constructor(@Inject(DB_CONNECTION) private readonly db: PostgresJsDatabase<typeof scheme>) {}

    async findByUsername(username: string) {
        return this.db.query.users.findFirst({
            where: eq(scheme.users.username, username),
        });
    }

    async create(username: string, passwordHash: string) {
        const [newUser] = await this.db.insert(scheme.users).values({
            username,
            password: passwordHash,
        }).returning();

        return newUser;
    }

    async resetPassword(userId: string, newPasswordHash: string) {
        const [updatedUser] = await this.db.update(scheme.users)
            .set({ password: newPasswordHash })
            .where(eq(scheme.users.id, userId))
            .returning();

        return updatedUser;
    }
}