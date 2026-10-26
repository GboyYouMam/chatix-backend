import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  inet,
  pgEnum,
  integer,
  boolean,
  primaryKey,
  jsonb,
  index,
  uniqueIndex,
  date,
} from 'drizzle-orm/pg-core';
import { desc, relations, sql } from 'drizzle-orm';

export const Roles = pgEnum('role', ['user', 'admin']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 25 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  role: Roles('role').notNull().default('user'),
  description: text('description'),
  vibe: varchar('vibe', { length: 50 }),
  pfp_url: varchar('pfp_url', { length: 255 }),
  //if user is stupid or we wanna have some fuuuuun
  warnsCount: integer('warns_count').default(0).notNull(),
  canChangeProfile: boolean('can_change_profile').default(true).notNull(),
  forcedTitle: varchar('forced_title', { length: 100 }),
  bannedUntil: timestamp('banned_until'),
  tokenVersion: integer('token_version').default(0).notNull(),
  banReason: text('ban_reason'),
  autoBannedAt: timestamp('auto_banned_at'),
  yapCooldown: timestamp('yap_cooldown'),
  //some bullshit that i just want to do cuz i can (or idk who cares anyway)
  aura: integer('aura').default(1000).notNull(),
  isMogged: boolean('is_mogged').default(false).notNull(),
  isClown: boolean('is_clown').default(false).notNull(),
  adminGlazeMode: boolean('admin_glaze_mode').default(false).notNull(),
  debt: integer('debt').default(0).notNull(),
  debtPaidCount: integer('debt_paid_count').default(0).notNull(),
  //-------------------------------------------------------------------------------------------------
  created_at: timestamp().defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  upper_banner_url: varchar('upper_banner_url', { length: 255 }),
  left_banner_url: varchar('left_banner_url', { length: 255 }),
  right_banner_url: varchar('right_banner_url', { length: 255 }),
  respectCount: integer('respect_count').default(0).notNull(),
  featuredAchievements: text('featured_achievements')
    .array()
    .default([])
    .notNull(),
  timezone: varchar('timezone', { length: 64 }),
  messagesCount: integer('messages_count').default(0).notNull(),
  auraFarmCount: integer('aura_farm_count').default(0).notNull(),
  fightsWon: integer('fights_won').default(0).notNull(),
  fightsLost: integer('fights_lost').default(0).notNull(),
  winStreak: integer('win_streak').default(0).notNull(),
  lossStreak: integer('loss_streak').default(0).notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  fightTitle: varchar('fight_title', { length: 50 }),
  fightTitleUntil: timestamp('fight_title_until', { withTimezone: true }),
  widgetLayout: jsonb('widget_layout')
    .$type<string[]>()
    .default(['medal_rack', 'fight_record', 'debt_meter', 'guestbook'])
    .notNull(),
  profileTrackUrl: varchar('profile_track_url', { length: 300 }),
  statusText: varchar('status_text', { length: 80 }),
  statusSetAt: timestamp('status_set_at', { withTimezone: true }),
  profileViews: integer('profile_views').default(0).notNull(),
  fightInsuranceArmed: boolean('fight_insurance_armed')
    .default(false)
    .notNull(),
  stimulusStreak: integer('stimulus_streak').default(0).notNull(),
  lastStimulusAt: timestamp('last_stimulus_at', { withTimezone: true }),
});

export const FightOutcome = pgEnum('fight_outcome', [
  'ko',
  'rage_quit',
  'cancelled',
]);

export const fights = pgTable(
  'fights',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    player1Id: uuid('player1_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    player2Id: uuid('player2_id').references(() => users.id, {
      onDelete: 'cascade',
    }),
    winnerId: uuid('winner_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    stakeType: varchar('stake_type', { length: 20 }).notNull(),
    stakeAmount: integer('stake_amount').notNull(),
    outcome: FightOutcome('outcome').notNull(),
    insured: boolean('insured').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    player1CreatedAtIdx: index('fights_player1_created_at_idx').on(
      table.player1Id,
      table.createdAt,
    ),
    player2CreatedAtIdx: index('fights_player2_created_at_idx').on(
      table.player2Id,
      table.createdAt,
    ),
    winnerCreatedAtIdx: index('fights_winner_created_at_idx').on(
      table.winnerId,
      table.createdAt,
    ),
  }),
);

export const userAchievements = pgTable(
  'user_achievements',
  {
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    key: varchar('key', { length: 40 }).notNull(),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.key] }),
    keyIdx: index('user_achievements_key_idx').on(table.key),
  }),
);

export const profileComments = pgTable(
  'profile_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileUserId: uuid('profile_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    authorId: uuid('author_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    body: text('body').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    profileCreatedAtIdx: index('profile_comments_profile_created_at_idx').on(
      table.profileUserId,
      table.createdAt,
    ),
    authorCreatedAtIdx: index('profile_comments_author_created_at_idx').on(
      table.authorId,
      table.createdAt,
    ),
  }),
);

export const profileRespects = pgTable(
  'profile_respects',
  {
    profileUserId: uuid('profile_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    admirerId: uuid('admirer_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.profileUserId, table.admirerId] }),
    admirerCreatedAtIdx: index('profile_respects_admirer_created_at_idx').on(
      table.admirerId,
      table.createdAt,
    ),
  }),
);

export const RoomState = pgEnum('room_state', [
  'active',
  'checkout',
  'banned',
  'quarantined',
  'rejected',
]);
export const RoomPublicity = pgEnum('room_publicity', ['public', 'private']);
export const rooms = pgTable(
  'rooms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    creatorId: uuid('creator_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    status: RoomState('room_state').default('checkout'),
    publicity: RoomPublicity('room_publicity').default('public'),
    title: varchar('title', { length: 255 }).notNull(),
    topic: varchar('topic', { length: 255 }),
    description: text('description'),
    password: varchar('password', { length: 255 }),
    //fun
    statusReason: text('status_reason'),
    theme: varchar('theme', { length: 24 }).default('basement').notNull(),
    sponsoredById: uuid('sponsored_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    sponsoredUntil: timestamp('sponsored_until', { withTimezone: true }),
    boostedUntil: timestamp('boosted_until', { withTimezone: true }),
    spotlightMessageId: uuid('spotlight_message_id'),
    spotlightUntil: timestamp('spotlight_until', { withTimezone: true }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    titleLowerUnique: uniqueIndex('rooms_title_lower_unique').on(
      sql`lower(${table.title})`,
    ),
  }),
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id')
      .references(() => rooms.id, { onDelete: 'cascade' })
      .notNull(),
    authorId: uuid('author_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    cipherText: text('cipher_text').notNull(),
    ipAddress: inet('ip_address'),
    attachmentUrl: varchar('attachment_url', { length: 1050 }),
    isDeleted: boolean('is_deleted').default(false).notNull(),
    kind: varchar('kind', { length: 12 }).default('user').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at'),
  },
  (table) => ({
    roomCreatedIdx: index('messages_room_created_idx').on(
      table.roomId,
      desc(table.createdAt),
      desc(table.id),
    ),
  }),
);

export const messageAttachments = pgTable(
  'message_attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id')
      .references(() => messages.id, { onDelete: 'cascade' })
      .notNull(),
    url: varchar('url', { length: 1050 }).notNull(),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 255 }).notNull(),
    size: integer('size').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    messageIdIdx: index('message_attachments_message_id_idx').on(
      table.messageId,
    ),
  }),
);

export const userWarnings = pgTable(
  'user_warnings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    adminId: uuid('admin_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    reason: text('reason').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    revokedAt: timestamp('revoked_at'),
  },
  (table) => ({
    userCreatedAtIdx: index('user_warnings_user_created_at_idx').on(
      table.userId,
      table.createdAt,
    ),
  }),
);

export const adminAuditLogs = pgTable(
  'admin_audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminId: uuid('admin_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    action: varchar('action', { length: 100 }).notNull(),
    actionKey: varchar('action_key', { length: 40 })
      .notNull()
      .default('legacy'),
    method: varchar('method', { length: 10 }).notNull(),
    path: varchar('path', { length: 500 }).notNull(),
    targetType: varchar('target_type', { length: 50 }),
    targetId: varchar('target_id', { length: 255 }),
    targetLabel: varchar('target_label', { length: 255 }),
    statusCode: integer('status_code').notNull(),
    success: boolean('success').notNull(),
    durationMs: integer('duration_ms').notNull(),
    details: jsonb('details').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    createdAtIdx: index('admin_audit_logs_created_at_idx').on(table.createdAt),
    adminCreatedAtIdx: index('admin_audit_logs_admin_created_at_idx').on(
      table.adminId,
      table.createdAt,
    ),
    targetTimelineIdx: index('admin_audit_logs_target_timeline_idx').on(
      table.targetType,
      table.targetId,
      table.createdAt,
    ),
  }),
);

export const usersRelations = relations(users, ({ many }) => ({
  rooms: many(rooms, { relationName: 'roomCreator' }),
  messages: many(messages),
  warnings: many(userWarnings, { relationName: 'warnedUser' }),
  warningsIssued: many(userWarnings, { relationName: 'warningAdmin' }),
  adminAuditLogs: many(adminAuditLogs),
  profileComments: many(profileComments, {
    relationName: 'profileUserComments',
  }),
  authoredProfileComments: many(profileComments, {
    relationName: 'profileCommentAuthor',
  }),
  receivedRespects: many(profileRespects, {
    relationName: 'profileUserRespects',
  }),
  givenRespects: many(profileRespects, {
    relationName: 'profileRespectAdmirer',
  }),
}));

export const profileCommentsRelations = relations(
  profileComments,
  ({ one }) => ({
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
  }),
);

export const profileRespectsRelations = relations(
  profileRespects,
  ({ one }) => ({
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
  }),
);

export const roomsRelations = relations(rooms, ({ one, many }) => ({
  creator: one(users, {
    fields: [rooms.creatorId],
    references: [users.id],
    relationName: 'roomCreator',
  }),
  sponsor: one(users, {
    fields: [rooms.sponsoredById],
    references: [users.id],
    relationName: 'roomSponsor',
  }),
  spotlightMessage: one(messages, {
    fields: [rooms.spotlightMessageId],
    references: [messages.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  author: one(users, { fields: [messages.authorId], references: [users.id] }),
  room: one(rooms, { fields: [messages.roomId], references: [rooms.id] }),
  attachments: many(messageAttachments),
}));

export const messageAttachmentsRelations = relations(
  messageAttachments,
  ({ one }) => ({
    message: one(messages, {
      fields: [messageAttachments.messageId],
      references: [messages.id],
    }),
  }),
);

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
  admin: one(users, {
    fields: [adminAuditLogs.adminId],
    references: [users.id],
  }),
}));

export const roomAccesses = pgTable(
  'room_accesses',
  {
    roomId: uuid('room_id')
      .references(() => rooms.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    grantedAt: timestamp('granted_at').defaultNow().notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.roomId, table.userId] }),
    };
  },
);

export const userInventory = pgTable(
  'user_inventory',
  {
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    itemKey: varchar('item_key', { length: 48 }).notNull(),
    quantity: integer('quantity').notNull().default(1),
    acquiredAt: timestamp('acquired_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.itemKey] }),
  }),
);

export const userEquipped = pgTable(
  'user_equipped',
  {
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    slot: varchar('slot', { length: 16 }).notNull(),
    itemKey: varchar('item_key', { length: 48 }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.slot] }),
  }),
);

export const shopPurchases = pgTable(
  'shop_purchases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    itemKey: varchar('item_key', { length: 48 }).notNull(),
    price: integer('price').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userCreatedAtIdx: index('shop_purchases_user_created_at_idx').on(
      table.userId,
      table.createdAt,
    ),
  }),
);

export const auraHistory = pgTable(
  'aura_history',
  {
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    day: date('day', { mode: 'string' }).notNull(),
    aura: integer('aura').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.day] }),
  }),
);

export const profileViewLog = pgTable(
  'profile_view_log',
  {
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    viewerKey: varchar('viewer_key', { length: 80 }).notNull(),
    day: date('day', { mode: 'string' }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.viewerKey, table.day] }),
  }),
);

export const profileEffects = pgTable(
  'profile_effects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    targetId: uuid('target_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    kind: varchar('kind', { length: 24 }).notNull(),
    appliedById: uuid('applied_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    targetKindExpiresIdx: index('profile_effects_target_kind_expires_idx').on(
      table.targetId,
      table.kind,
      table.expiresAt,
    ),
  }),
);
