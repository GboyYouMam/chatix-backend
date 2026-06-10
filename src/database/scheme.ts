import { pgTable, uuid, varchar, text, timestamp, inet, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const Roles = pgEnum('role', ['user', 'admin']);

export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    username: varchar('username', {length: 25}).notNull().unique(),
    password: varchar('password', {length: 255}).notNull().unique(),
    role: Roles('role').notNull().default('user'),
    description: text('description'),
    vibe: varchar('vibe', {length: 50}),
    pfp_url: varchar('pfp_url', {length: 255}),
    created_at: timestamp().defaultNow().notNull()
})

export const RoomState = pgEnum('room_state', ['active', 'checkout', 'banned']);
export const RoomPublicity = pgEnum('room_publicity', ['public', 'private']);
export const rooms = pgTable('rooms', {
    id: uuid('id').primaryKey().defaultRandom(),
    creatorId: uuid('creator_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    status: RoomState('room_state').default('checkout'),
    publicity: RoomPublicity('room_publicity').default('public'),
    title: varchar('title', { length: 255 }).notNull(),
    topic: varchar('topic', { length: 255 }),
    description: text('description'),
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