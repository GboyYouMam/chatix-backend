import type { userEquipped } from '../database/scheme';

export const EQUIP_SLOTS = [
  'accent',
  'background',
  'title',
  'nameColor',
  'nameIcon',
  'quoteStyle',
  'nyanCat',
  'verified',
  'sticker1',
  'sticker2',
  'sticker3',
] as const;

export type EquipSlot = (typeof EQUIP_SLOTS)[number];

// Items every user may equip without owning them.
export const FREE_ITEM_KEYS: ReadonlySet<string> = new Set(['accent_hot_pink']);

const SLOT_ACCEPTS: Record<EquipSlot, (itemKey: string) => boolean> = {
  accent: (key) => key.startsWith('accent_'),
  background: (key) => key.startsWith('bg_'),
  title: (key) => key.startsWith('title_'),
  nameColor: (key) => key.startsWith('namecolor_'),
  nameIcon: (key) => key.startsWith('nameicon_'),
  quoteStyle: (key) => key.startsWith('quote_'),
  nyanCat: (key) => key === 'nyan_cat',
  verified: (key) => key === 'verified_chud',
  sticker1: (key) => key.startsWith('sticker_'),
  sticker2: (key) => key.startsWith('sticker_'),
  sticker3: (key) => key.startsWith('sticker_'),
};

export function slotAccepts(slot: EquipSlot, itemKey: string): boolean {
  return SLOT_ACCEPTS[slot](itemKey);
}

export function isEquipSlot(value: string): value is EquipSlot {
  return (EQUIP_SLOTS as readonly string[]).includes(value);
}

export interface EquippedState {
  accent: string | null;
  background: string | null;
  title: string | null;
  nameColor: string | null;
  nameIcon: string | null;
  quoteStyle: string | null;
  nyanCat: boolean;
  verified: boolean;
  stickers: [string | null, string | null, string | null];
}

type EquippedRow = Pick<typeof userEquipped.$inferSelect, 'slot' | 'itemKey'>;

export function equippedFromRows(rows: EquippedRow[]): EquippedState {
  const bySlot = new Map(rows.map((row) => [row.slot, row.itemKey]));
  const get = (slot: EquipSlot) => bySlot.get(slot) ?? null;
  return {
    accent: get('accent'),
    background: get('background'),
    title: get('title'),
    nameColor: get('nameColor'),
    nameIcon: get('nameIcon'),
    quoteStyle: get('quoteStyle'),
    nyanCat: bySlot.has('nyanCat'),
    verified: bySlot.has('verified'),
    stickers: [get('sticker1'), get('sticker2'), get('sticker3')],
  };
}
