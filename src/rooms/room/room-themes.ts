export const ROOM_THEMES = [
  'basement',
  'fight_club',
  'vaporwave',
  'corpo',
  'crime_scene',
  'win98',
  'graveyard',
] as const;

export type RoomTheme = (typeof ROOM_THEMES)[number];

export const DEFAULT_ROOM_THEME: RoomTheme = 'basement';
