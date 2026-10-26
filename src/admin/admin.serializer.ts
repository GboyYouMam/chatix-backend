import { toPublicRoom } from '../rooms/room/room.serializer';
import type * as scheme from '../database/scheme';

export function toAdminUser(
  row: Omit<typeof scheme.users.$inferSelect, 'password'> & {
    password?: string;
  },
  activeWarningsCount: number,
) {
  const bannedUntil = row.bannedUntil;
  const { password, tokenVersion, autoBannedAt, ...user } = row;
  void password;
  void tokenVersion;
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    pfpUrl: user.pfp_url,
    description: user.description,
    vibe: user.vibe,
    aura: user.aura,
    debt: user.debt,
    respectCount: user.respectCount,
    isClown: user.isClown,
    isMogged: user.isMogged,
    adminGlazeMode: user.adminGlazeMode,
    canChangeProfile: user.canChangeProfile,
    forcedTitle: user.forcedTitle,
    bannedUntil: bannedUntil?.toISOString() ?? null,
    banReason: user.banReason,
    isAutoBanned: Boolean(
      autoBannedAt && bannedUntil && bannedUntil > new Date(),
    ),
    yapCooldown: user.yapCooldown?.toISOString() ?? null,
    activeWarningsCount,
    createdAt: user.created_at.toISOString(),
  };
}

export function toAdminRoom(
  room: typeof scheme.rooms.$inferSelect,
  messagesCount: number,
) {
  const { quarantineReason, quarantinedUntil, ...publicRoom } =
    toPublicRoom(room);
  return {
    ...publicRoom,
    quarantineReason,
    quarantinedUntil: quarantinedUntil?.toISOString() ?? null,
    messagesCount,
  };
}
