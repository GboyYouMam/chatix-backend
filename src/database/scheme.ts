import {pgTable, uuid, varchar, text, timestamp, inet, pgEnum, integer, boolean, primaryKey} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import {iterator} from "rxjs/internal/symbol/iterator";

export const Roles = pgEnum('role', ['user', 'admin']);

export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    username: varchar('username', {length: 25}).notNull().unique(),
    password: varchar('password', {length: 255}).notNull().unique(),
    role: Roles('role').notNull().default('user'),
    description: text('description'),
    vibe: varchar('vibe', {length: 50}),
    pfp_url: varchar('pfp_url', {length: 255}),
    //if user is stupid or we wanna have some fuuuuun
    warnsCount: integer('warns_count').default(0).notNull(),
    canChangeProfile: boolean('can_change_profile').default(true).notNull(),
    forcedTitle: varchar('forced_title', { length: 100 }),
    bannedUntil: timestamp('banned_until'),
    yapCooldown: timestamp('yap_cooldown'),
    //some bullshit that i just want to do cuz i can (or idk who cares anyway)
    aura: integer('aura').default(1000).notNull(),
    isMogged: boolean('is_mogged').default(false).notNull(),
    isClown: boolean('is_clown').default(false).notNull(),
    adminGlazeMode: boolean('admin_glaze_mode').default(false).notNull(),
    debt: integer('debt').default(0).notNull(),
    //-------------------------------------------------------------------------------------------------
    created_at: timestamp().defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
})

export const RoomState = pgEnum('room_state', ['active', 'checkout', 'banned', 'quarantined']);
export const RoomPublicity = pgEnum('room_publicity', ['public', 'private']);
export const rooms = pgTable('rooms', {
    id: uuid('id').primaryKey().defaultRandom(),
    creatorId: uuid('creator_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    status: RoomState('room_state').default('checkout'),
    publicity: RoomPublicity('room_publicity').default('public'),
    title: varchar('title', { length: 255 }).notNull(),
    topic: varchar('topic', { length: 255 }),
    description: text('description'),
    password: varchar('password', { length: 255 }),
    //fun
    quarantineReason: text('quarantine_reason'),
    quarantinedUntil: timestamp('quarantined_until'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const messages = pgTable('messages', {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'cascade' }).notNull(),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    cipherText: text('cipher_text').notNull(),
    ipAddress: inet('ip_address'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at'),
});

export const usersRelations = relations(users, ({ many }) => ({
    rooms: many(rooms),
    messages: many(messages),
}));

export const roomsRelations = relations(rooms, ({ one, many }) => ({
    creator: one(users, { fields: [rooms.creatorId], references: [users.id] }),
    messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
    author: one(users, { fields: [messages.authorId], references: [users.id] }),
    room: one(rooms, { fields: [messages.roomId], references: [rooms.id] }),
}));

export const roomAccesses = pgTable('room_accesses', {
    roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'cascade' }).notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    grantedAt: timestamp('granted_at').defaultNow().notNull(),
}, (table) => {
    return {
        pk: primaryKey({ columns: [table.roomId, table.userId] })
    };
});