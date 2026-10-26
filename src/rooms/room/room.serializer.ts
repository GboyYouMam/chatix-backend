type RoomPerkFields = {
  theme?: string | null;
  sponsoredById?: string | null;
  sponsoredUntil?: Date | null;
  boostedUntil?: Date | null;
  spotlightMessageId?: string | null;
  spotlightUntil?: Date | null;
  sponsor?: { username: string } | null;
  spotlightMessage?: {
    id: string;
    cipherText: string;
    createdAt: Date;
    isDeleted: boolean;
    author?: { id: string; username: string; pfp_url: string | null } | null;
  } | null;
};

export function toPublicRoom<
  T extends {
    password?: string | null;
    quarantineReason?: string | null;
    statusReason?: string | null;
    creatorId?: string;
  } & RoomPerkFields,
>(room: T, viewer?: { userId: string; role: string }) {
  const {
    password,
    quarantineReason,
    statusReason,
    sponsor,
    sponsoredUntil,
    boostedUntil,
    spotlightUntil,
    spotlightMessage,
    ...data
  } = room;
  const now = Date.now();
  const isLive = (until: Date | null | undefined) =>
    Boolean(until && until.getTime() > now);

  const sponsoredBy =
    sponsor && isLive(sponsoredUntil) ? { username: sponsor.username } : null;
  const spotlight =
    spotlightMessage && !spotlightMessage.isDeleted && isLive(spotlightUntil)
      ? {
          message: {
            id: spotlightMessage.id,
            cipherText: spotlightMessage.cipherText,
            createdAt: spotlightMessage.createdAt,
            author: spotlightMessage.author ?? null,
          },
          expiresAt: spotlightUntil as Date,
        }
      : null;

  const result = {
    ...data,
    theme: room.theme ?? 'basement',
    hasPassword: Boolean(password),
    sponsoredBy,
    boostedUntil: isLive(boostedUntil) ? boostedUntil : null,
    spotlight,
  } as Record<string, unknown>;
  if (viewer && (viewer.role === 'admin' || viewer.userId === room.creatorId)) {
    result.statusReason = statusReason ?? quarantineReason ?? null;
  }
  return result;
}
