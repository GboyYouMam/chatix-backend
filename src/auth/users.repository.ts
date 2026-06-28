import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB_CONNECTION } from "../database/database.module";
import * as scheme from '../database/scheme';
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export interface UpdateUserData {
    username?: string;
    description?: string;
    vibe?: string;
    pfp_url?: string;
}

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

    async findById(userId: string) {
        return this.db.query.users.findFirst({
            where: eq(scheme.users.id, userId),
            columns: {
                password: false,
            }
        });
    }

    async updateAvatar(userId: string, avatarUrl: string) {
        const [updatedUser] = await this.db.update(scheme.users)
            .set({ pfp_url: avatarUrl })
            .where(eq(scheme.users.id, userId))
            .returning({
                id: scheme.users.id,
                pfp_url: scheme.users.pfp_url
            });

        return updatedUser;
    }

    async updateProfile(userId: string, data: UpdateUserData) {
        const [updatedUser] = await this.db.update(scheme.users)
            .set(data)
            .where(eq(scheme.users.id, userId))
            .returning({
                id: scheme.users.id,
                username: scheme.users.username,
                pfp_url: scheme.users.pfp_url,
                description: scheme.users.description,
                vibe: scheme.users.vibe
            });

        return updatedUser;
    }

    async vaporizeUser(userId: string) {
        const [vaporizedUser] = await this.db.update(scheme.users)
            .set({
                username: `deleted_user_${userId.substring(0, 8)}`,
                pfp_url: null,
                description: 'VAPORIZED BY ADMINS, GOD BLESS HIS SIN SOUL',
                vibe: null,
                isClown: true,
                bannedUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 100),
            })
            .where(eq(scheme.users.id, userId))
            .returning();

        return vaporizedUser;
    }

    async findAllForAdmin() {
        return this.db.query.users.findMany({
            columns: { password: false },
            orderBy: (users, { desc }) => [desc(users.aura)] // Сортуємо по аурі
        });
    }

    async payDebt(userId: string) {
        const user = await this.findById(userId);
        if (user && user.debt > 0) {
            const [updatedUser] = await this.db.update(scheme.users)
                .set({ debt: user.debt - 1 })
                .where(eq(scheme.users.id, userId))
                .returning({ id: scheme.users.id, debt: scheme.users.debt });
            return updatedUser;
        }
        return user;
    }
}