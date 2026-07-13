import {pgTable, uuid, varchar, text, timestamp, inet, pgEnum, integer, boolean, primaryKey, jsonb, index} from 'drizzle-orm/pg-core';
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
    upper_banner_url: varchar('upper_banner_url', {length: 255}),
    left_banner_url: varchar('left_banner_url', {length: 255}),
    right_banner_url: varchar('right_banner_url', {length: 255}),
    respectCount: integer('respect_count').default(0).notNull(),
})

export const profileComments = pgTable('profile_comments', {
    id: uuid('id').primaryKey().defaultRandom(),
    profileUserId: uuid('profile_user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    body: text('body').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
    profileCreatedAtIdx: index('profile_comments_profile_created_at_idx').on(table.profileUserId, table.createdAt),
    authorCreatedAtIdx: index('profile_comments_author_created_at_idx').on(table.authorId, table.createdAt),
}));

export const profileRespects = pgTable('profile_respects', {
    profileUserId: uuid('profile_user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    admirerId: uuid('admirer_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    pk: primaryKey({ columns: [table.profileUserId, table.admirerId] }),
    admirerCreatedAtIdx: index('profile_respects_admirer_created_at_idx').on(table.admirerId, table.createdAt),
}));

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

export const userWarnings = pgTable('user_warnings', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    adminId: uuid('admin_id').references(() => users.id, { onDelete: 'set null' }),
    reason: text('reason').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    revokedAt: timestamp('revoked_at'),
}, (table) => ({
    userCreatedAtIdx: index('user_warnings_user_created_at_idx').on(table.userId, table.createdAt),
}));

export const adminAuditLogs = pgTable('admin_audit_logs', {
    id: uuid('id').primaryKey().defaultRandom(),
    adminId: uuid('admin_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 100 }).notNull(),
    method: varchar('method', { length: 10 }).notNull(),
    path: varchar('path', { length: 500 }).notNull(),
    targetType: varchar('target_type', { length: 50 }),
    targetId: varchar('target_id', { length: 255 }),
    statusCode: integer('status_code').notNull(),
    success: boolean('success').notNull(),
    durationMs: integer('duration_ms').notNull(),
    details: jsonb('details').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    createdAtIdx: index('admin_audit_logs_created_at_idx').on(table.createdAt),
    adminCreatedAtIdx: index('admin_audit_logs_admin_created_at_idx').on(table.adminId, table.createdAt),
}));

export const usersRelations = relations(users, ({ many }) => ({
    rooms: many(rooms),
    messages: many(messages),
    warnings: many(userWarnings, { relationName: 'warnedUser' }),
    warningsIssued: many(userWarnings, { relationName: 'warningAdmin' }),
    adminAuditLogs: many(adminAuditLogs),
    profileComments: many(profileComments, { relationName: 'profileUserComments' }),
    authoredProfileComments: many(profileComments, { relationName: 'profileCommentAuthor' }),
    receivedRespects: many(profileRespects, { relationName: 'profileUserRespects' }),
    givenRespects: many(profileRespects, { relationName: 'profileRespectAdmirer' }),
}));

export const profileCommentsRelations = relations(profileComments, ({ one }) => ({
    profileUser: one(users, {
        fields: [profileComments.profileUserId],
        references: [users.id],
        relationName: 'profileUserComments',
    }),
    author: one(users, {
        fields: [profileComments.authorId],
        references: [users.id],
        relationName: 'profileCommentAuthor',
    }),
}));

export const profileRespectsRelations = relations(profileRespects, ({ one }) => ({
    profileUser: one(users, {
        fields: [profileRespects.profileUserId],
        references: [users.id],
        relationName: 'profileUserRespects',
    }),
    admirer: one(users, {
        fields: [profileRespects.admirerId],
        references: [users.id],
        relationName: 'profileRespectAdmirer',
    }),
}));

export const roomsRelations = relations(rooms, ({ one, many }) => ({
    creator: one(users, { fields: [rooms.creatorId], references: [users.id] }),
    messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
    author: one(users, { fields: [messages.authorId], references: [users.id] }),
    room: one(rooms, { fields: [messages.roomId], references: [rooms.id] }),
}));

export const userWarningsRelations = relations(userWarnings, ({ one }) => ({
    user: one(users, {
        fields: [userWarnings.userId],
        references: [users.id],
        relationName: 'warnedUser',
    }),
    admin: one(users, {
        fields: [userWarnings.adminId],
        references: [users.id],
        relationName: 'warningAdmin',
    }),
}));

export const adminAuditLogsRelations = relations(adminAuditLogs, ({ one }) => ({
    admin: one(users, { fields: [adminAuditLogs.adminId], references: [users.id] }),
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
