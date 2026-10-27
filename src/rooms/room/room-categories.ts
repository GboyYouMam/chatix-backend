export const ROOM_CATEGORIES = [
  'gaming',
  'tech',
  'memes',
  'music',
  'anime',
  'movies',
  'sports',
  'study',
  'art',
  'politics',
  'vent',
  'offtopic',
] as const;

export type RoomCategory = (typeof ROOM_CATEGORIES)[number];
