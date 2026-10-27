export type ShopCategory = 'profile' | 'chat' | 'troll' | 'economy' | 'theme';
export type ShopKind = 'permanent' | 'consumable';
export type ShopRequirement = 'found_the_basement';

export interface ShopItem {
  key: string;
  name: string;
  description: string;
  category: ShopCategory;
  kind: ShopKind;
  price: number;
  requires?: ShopRequirement;
}

export const ACCENT_PALETTE: Record<string, string> = {
  hot_pink: '#fa4d98',
  magenta: '#e11d74',
  acid_pink: '#ff4fd8',
  deep_violet: '#7c3aed',
  cold_red: '#ef3b5c',
  rose: '#fb7185',
};

const profile = (
  key: string,
  name: string,
  description: string,
  kind: ShopKind,
  price: number,
): ShopItem => ({ key, name, description, category: 'profile', kind, price });

const chat = (
  key: string,
  name: string,
  description: string,
  price: number,
): ShopItem => ({
  key,
  name,
  description,
  category: 'chat',
  kind: 'permanent',
  price,
});

const troll = (
  key: string,
  name: string,
  description: string,
  price: number,
): ShopItem => ({
  key,
  name,
  description,
  category: 'troll',
  kind: 'consumable',
  price,
});

const economy = (
  key: string,
  name: string,
  description: string,
  price: number,
): ShopItem => ({
  key,
  name,
  description,
  category: 'economy',
  kind: 'consumable',
  price,
});

const theme = (
  key: string,
  name: string,
  description: string,
  price: number,
  requires?: ShopRequirement,
): ShopItem => ({
  key,
  name,
  description,
  category: 'theme',
  kind: 'permanent',
  price,
  ...(requires ? { requires } : {}),
});

export const SHOP_ITEMS: readonly ShopItem[] = [
  // profile
  profile(
    'accent_magenta',
    'magenta accent',
    'louder than your last take.',
    'permanent',
    400,
  ),
  profile(
    'accent_acid_pink',
    'acid pink accent',
    'radioactive. your ex will feel it.',
    'permanent',
    400,
  ),
  profile(
    'accent_deep_violet',
    'deep violet accent',
    'royalty energy. nobody asked.',
    'permanent',
    400,
  ),
  profile(
    'accent_cold_red',
    'cold red accent',
    'a red that does not care about your feelings.',
    'permanent',
    400,
  ),
  profile(
    'accent_rose',
    'rose accent',
    'soft on the outside. chud on the inside.',
    'permanent',
    400,
  ),
  profile(
    'bg_scanlines',
    'scanlines',
    'crt energy. your monitor is not ready.',
    'permanent',
    600,
  ),
  profile(
    'bg_starfield',
    'starfield',
    'you are a star. a small one. in a bad galaxy.',
    'permanent',
    600,
  ),
  profile(
    'bg_matrix_pink',
    'matrix but pink',
    'wake up. the simulation is pink now.',
    'permanent',
    600,
  ),
  profile(
    'bg_static',
    'static',
    'channel 3, but it is your profile.',
    'permanent',
    600,
  ),
  profile(
    'bg_grid',
    'grid',
    'graph paper for people with no plan.',
    'permanent',
    600,
  ),
  profile(
    'title_certified_yapper',
    'certified yapper',
    'you type paragraphs to say "lol".',
    'permanent',
    300,
  ),
  profile(
    'title_basement_dweller',
    'basement dweller',
    'the sun is a rumor.',
    'permanent',
    300,
  ),
  profile(
    'title_debt_collector',
    'debt collector',
    'you collect what you are owed. mostly vibes.',
    'permanent',
    300,
  ),
  profile(
    'title_touched_grass_once',
    'touched grass once',
    'it was wet. you did not enjoy it.',
    'permanent',
    300,
  ),
  profile(
    'title_aura_merchant',
    'aura merchant',
    'selling aura you do not have. respect.',
    'permanent',
    300,
  ),
  profile(
    'verified_chud',
    'verified chud',
    'a pink check. verified by nobody.',
    'permanent',
    1500,
  ),
  profile(
    'hit_counter',
    'hit counter',
    '2003 called. it wants its guestbook back. unlocks the widget.',
    'permanent',
    200,
  ),
  profile(
    'vine_boom',
    'vine boom button',
    'booms at whoever clicks it. no refunds on the boom.',
    'permanent',
    350,
  ),
  // chat
  chat(
    'namecolor_hot_pink',
    'hot pink name',
    'the default, but with a receipt.',
    300,
  ),
  chat(
    'namecolor_magenta',
    'magenta name',
    'very aggressive. very magenta.',
    300,
  ),
  chat(
    'namecolor_acid_pink',
    'acid pink name',
    'your name, now radioactive.',
    300,
  ),
  chat(
    'namecolor_deep_violet',
    'deep violet name',
    'he thinks he is royalty.',
    300,
  ),
  chat(
    'namecolor_cold_red',
    'cold red name',
    'nobody in the chat is safe.',
    300,
  ),
  chat('namecolor_rose', 'rose name', 'soft pink name. still chud.', 300),
  chat(
    'nameicon_skull',
    'skull icon',
    'a skull before your name. ominous.',
    250,
  ),
  chat(
    'nameicon_soap',
    'soap icon',
    'a soap before your name. cleanliness is a myth.',
    250,
  ),
  chat(
    'nameicon_crown',
    'crown icon',
    'a crown before your name. nobody elected you.',
    250,
  ),
  chat(
    'nameicon_clown',
    'clown icon',
    'a clown before your name. accurate.',
    250,
  ),
  chat(
    'quote_neon',
    'neon quotes',
    'your >>id references glow. you need attention.',
    200,
  ),
  chat(
    'quote_greentext',
    'greentext quotes',
    'your >>id references in greentext. anon would be proud.',
    200,
  ),
  chat(
    'quote_redacted',
    'redacted quotes',
    'your >>id references censored. the fbi cannot read them either.',
    200,
  ),
  // troll
  troll(
    'clown_stamp',
    'clown stamp',
    'stamps "certified clown" on someone else\'s profile for 24 h.',
    120,
  ),
  troll(
    'rename_curse',
    'rename curse',
    'their name gets "(certified npc)" for 1 h. sorry not sorry.',
    150,
  ),
  troll(
    'aura_tax',
    'aura tax',
    'your room says "sponsored by @you" for 24 h. capitalism.',
    500,
  ),
  troll(
    'spotlight',
    'spotlight',
    'pins your message on top of a room for 10 min. look at me.',
    200,
  ),
  troll(
    'room_boost',
    'room boost',
    'your room first in the lobby, "promoted", for 1 h. paid hype.',
    400,
  ),
  // economy
  economy(
    'fight_insurance',
    'fight insurance',
    'next fight you lose costs half. the winner gets the other half. fair. kinda.',
    250,
  ),
  economy(
    'debt_forgiveness',
    'debt forgiveness',
    'clears 100 debt on use. a bad rate, but a rate.',
    300,
  ),
  economy(
    'mystery_soap',
    'mystery soap',
    'random cosmetic. common 70 / rare 25 / legendary 5. dupes refund 50%. no refunds on regret.',
    180,
  ),
  // themes
  theme(
    'theme_vaporwave',
    'vaporwave room',
    'purple-pink room for rooms you create. an aesthetic. ahh.',
    800,
  ),
  theme(
    'theme_corpo',
    'corpo room',
    'boring white office room. per my last email.',
    800,
  ),
  theme(
    'theme_crime_scene',
    'crime scene room',
    'black and yellow tape. nobody saw anything.',
    800,
  ),
  theme(
    'theme_win98',
    'win98 room',
    'grey windows, blue title bars, "ok" and "cringe" buttons.',
    800,
  ),
  theme(
    'theme_graveyard',
    'graveyard room',
    'for dead rooms. messages are tombstones.',
    800,
  ),
  theme(
    'theme_fight_club',
    'fight club room',
    'rule one: you do not talk about it. rule two: buy this.',
    1200,
    'found_the_basement',
  ),
];

const PALETTE_KEYS = Object.keys(ACCENT_PALETTE);

export const NAME_COLOR_ITEM_KEYS: readonly string[] = PALETTE_KEYS.map(
  (palette) => `namecolor_${palette}`,
);

export const ACCENT_ITEM_KEYS: readonly string[] = PALETTE_KEYS.filter(
  (palette) => palette !== 'hot_pink',
).map((palette) => `accent_${palette}`);

export const SHOP_ITEM_KEYS: ReadonlySet<string> = new Set(
  SHOP_ITEMS.map((item) => item.key),
);

export const MYSTERY_SOAP_ODDS = {
  common: 70,
  rare: 25,
  legendary: 5,
} as const;

const keysStartingWith = (prefixes: string[]): string[] =>
  SHOP_ITEMS.filter((item) =>
    prefixes.some((prefix) => item.key.startsWith(prefix)),
  ).map((item) => item.key);

export const MYSTERY_SOAP_POOLS = {
  common: keysStartingWith(['quote_', 'title_']),
  rare: keysStartingWith(['bg_', 'nameicon_', 'accent_', 'namecolor_']),
  legendary: ['verified_chud'],
} as const;

export function findShopItem(key: string): ShopItem | undefined {
  return SHOP_ITEMS.find((item) => item.key === key);
}
