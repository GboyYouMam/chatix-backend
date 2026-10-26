export function toPublicRoom<
  T extends {
    password?: string | null;
    quarantineReason?: string | null;
    statusReason?: string | null;
    creatorId?: string;
  },
>(room: T, viewer?: { userId: string; role: string }) {
  const { password, quarantineReason, statusReason, ...data } = room;
  const result = { ...data, hasPassword: Boolean(password) } as Record<
    string,
    unknown
  >;
  if (viewer && (viewer.role === 'admin' || viewer.userId === room.creatorId)) {
    result.statusReason = statusReason ?? quarantineReason ?? null;
  }
  return result;
}
