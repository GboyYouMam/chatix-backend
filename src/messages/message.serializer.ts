import type { AuthorCosmetics } from '../shop/cosmetics.service';

type MessageRow = {
  id: string;
  roomId: string;
  cipherText: string;
  createdAt: Date;
  isDeleted: boolean;
  ipAddress: string | null;
  attachmentUrl?: string | null;
  author?: {
    id: string;
    username: string;
    pfp_url: string | null;
    forcedTitle: string | null;
    isMogged?: boolean;
    featuredAchievements?: string[];
  } | null;
  attachments?: {
    id: string;
    url: string;
    fileName: string;
    mimeType: string;
    size: number;
  }[];
  room?: { id: string; title: string } | null;
};

const NO_AUTHOR_COSMETICS: AuthorCosmetics = {
  nameColor: null,
  nameIcon: null,
  quoteStyle: null,
};

export function toPublicMessage(
  row: MessageRow,
  ipTag: string | null,
  authorCosmetics: AuthorCosmetics = NO_AUTHOR_COSMETICS,
) {
  return {
    id: row.id,
    roomId: row.roomId,
    cipherText: row.cipherText,
    createdAt: row.createdAt,
    isDeleted: row.isDeleted,
    ipTag,
    author: row.author
      ? {
          id: row.author.id,
          username: row.author.username,
          pfp_url: row.author.pfp_url,
          forcedTitle: row.author.forcedTitle,
          isMogged: row.author.isMogged ?? false,
          featuredAchievements: row.author.featuredAchievements ?? [],
          cosmetics: {
            nameColor: authorCosmetics.nameColor,
            nameIcon: authorCosmetics.nameIcon,
            quoteStyle: authorCosmetics.quoteStyle,
          },
        }
      : null,
    attachments: row.attachments ?? [],
  };
}

export function toAdminMessage(row: MessageRow) {
  return {
    ...toPublicMessage(row, null),
    ipAddress: row.ipAddress,
    room: row.room ? { id: row.room.id, title: row.room.title } : null,
  };
}
