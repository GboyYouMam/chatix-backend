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

export function toPublicMessage(row: MessageRow, ipTag: string | null) {
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
          featuredAchievements: [],
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
