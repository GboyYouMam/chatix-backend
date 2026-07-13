import { Injectable, Inject } from '@nestjs/common';
import { and, count, desc, eq } from 'drizzle-orm';
import { DB_CONNECTION } from "../database/database.module";
import * as scheme from '../database/scheme';
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export interface UpdateUserData {
    username?: string;
    description?: string;
    vibe?: string;
    pfp_url?: string;
    upper_banner_url?: string;
    left_banner_url?: string;
    right_banner_url?: string;

}

@Injectable()
export class UsersRepository {
    constructor(@Inject(DB_CONNECTION) private readonly db: PostgresJsDatabase<typeof scheme>) {}

    async findByUsername(username: string) {
        return this.db.query.users.findFirst({
            where: eq(scheme.users.username, username),
        });
    }

    async findPublicByUsername(username: string) {
        return this.db.query.users.findFirst({
            where: eq(scheme.users.username, username),
            columns: {
                password: false,
            },
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
                upper_banner_url: scheme.users.upper_banner_url,
                left_banner_url: scheme.users.left_banner_url,
                right_banner_url: scheme.users.right_banner_url,
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
            orderBy: (users, { desc }) => [desc(users.aura)]
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

    async findProfileComments(profileUserId: string, limit = 50) {
        return this.db.query.profileComments.findMany({
            where: eq(scheme.profileComments.profileUserId, profileUserId),
            orderBy: [desc(scheme.profileComments.createdAt)],
            limit,
            with: {
                author: {
                    columns: {
                        id: true,
                        username: true,
                        pfp_url: true,
                    },
                },
            },
        });
    }

    async createProfileComment(profileUserId: string, authorId: string, body: string) {
        const [comment] = await this.db
            .insert(scheme.profileComments)
            .values({ profileUserId, authorId, body })
            .returning({ id: scheme.profileComments.id });

        return comment;
    }

    async hasRespectedProfile(profileUserId: string, admirerId: string) {
        const respect = await this.db.query.profileRespects.findFirst({
            where: and(
                eq(scheme.profileRespects.profileUserId, profileUserId),
                eq(scheme.profileRespects.admirerId, admirerId),
            ),
        });

        return Boolean(respect);
    }

    async giveProfileRespect(profileUserId: string, admirerId: string) {
        const [inserted] = await this.db
            .insert(scheme.profileRespects)
            .values({ profileUserId, admirerId })
            .onConflictDoNothing()
            .returning({ profileUserId: scheme.profileRespects.profileUserId });

        return {
            respected: true,
            alreadyRespected: !inserted,
        };
    }

    async countProfileRespects(profileUserId: string) {
        const [{ total }] = await this.db
            .select({ total: count() })
            .from(scheme.profileRespects)
            .where(eq(scheme.profileRespects.profileUserId, profileUserId));

        return total;
    }
}
