export type AchievementCategory =
  | 'aura'
  | 'debt'
  | 'fight'
  | 'rooms'
  | 'social'
  | 'moderation'
  | 'secret';
export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'shame' | 'secret';

export interface AchievementDef {
  key: string;
  name: string;
  description: string;
  category: AchievementCategory;
  tier: AchievementTier;
  icon: string;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  ['first_farm', 'first farm', 'farm aura once.', 'aura', 'bronze', '🌱'],
  [
    'aura_farmer',
    'aura farmer',
    'farm aura 1,000 times.',
    'aura',
    'silver',
    '🚜',
  ],
  ['aura_god', 'aura god', 'reach 10,000 aura.', 'aura', 'gold', '✨'],
  [
    'in_the_negatives',
    'in the negatives',
    'drop below zero aura.',
    'aura',
    'shame',
    '📉',
  ],
  [
    'bankrupt_vibes',
    'bankrupt vibes',
    'reach -1,000 aura.',
    'aura',
    'shame',
    '🪦',
  ],
  [
    'first_debt',
    'first debt',
    'owe aura for the first time.',
    'debt',
    'bronze',
    '🧾',
  ],
  [
    'debt_free',
    'debt free',
    'pay off at least 100 debt.',
    'debt',
    'silver',
    '🕊️',
  ],
  ['debt_lord', 'debt lord', 'reach 1,000 debt.', 'debt', 'gold', '👑'],
  [
    'financial_cushion',
    'financial cushion',
    'get your debt below zero.',
    'debt',
    'silver',
    '🛟',
  ],
  ['loan_shark', 'loan shark', 'reach -1,000 debt.', 'debt', 'gold', '🦈'],
  [
    'found_the_basement',
    'found the basement',
    'discover the basement.',
    'secret',
    'secret',
    '❔',
  ],
  [
    'first_blood',
    'first blood',
    'win your first fight.',
    'fight',
    'bronze',
    '🥊',
  ],
  [
    'basement_regular',
    'basement regular',
    'finish 10 fights.',
    'fight',
    'silver',
    '🥋',
  ],
  ['undefeated', 'undefeated', 'win 5 fights in a row.', 'fight', 'gold', '🏆'],
  ['high_roller', 'high roller', 'stake at least 500.', 'fight', 'gold', '🎰'],
  [
    'rage_quitter',
    'rage quitter',
    'leave a fight mid-match.',
    'fight',
    'shame',
    '🏃',
  ],
  [
    'professionally_mogged',
    'professionally mogged',
    'lose 10 fights in a row.',
    'fight',
    'shame',
    '🫠',
  ],
  [
    'the_soap_market',
    'the soap market',
    'finish 3 fights in an hour.',
    'fight',
    'silver',
    '🧼',
  ],
  [
    'got_mogged_by_a_clown',
    'got mogged by a clown',
    'lose to a clown.',
    'fight',
    'shame',
    '🤡',
  ],
  [
    'landlord',
    'landlord',
    'get your first room approved.',
    'rooms',
    'bronze',
    '🏠',
  ],
  ['yapper', 'yapper', 'send 100 messages.', 'rooms', 'bronze', '💬'],
  [
    'certified_yapper',
    'certified yapper',
    'send 1,000 messages.',
    'rooms',
    'gold',
    '📣',
  ],
  ['ratio_d', "ratio'd", 'get your room quarantined.', 'rooms', 'shame', '🧂'],
  [
    'necromancer',
    'necromancer',
    'post in a room silent for 30 days.',
    'rooms',
    'secret',
    '🧟',
  ],
  ['respected', 'respected', 'get 10 respects.', 'social', 'bronze', '🤝'],
  ['glazed', 'glazed', 'get 100 respects.', 'social', 'gold', '🍯'],
  [
    'clown_certified',
    'clown certified',
    'get clown status.',
    'social',
    'shame',
    '🤡',
  ],
  [
    'admins_favourite',
    "admin's favourite",
    'get admin glaze mode.',
    'social',
    'gold',
    '💅',
  ],
  [
    'first_warn',
    'first warn',
    'get your first warning.',
    'moderation',
    'shame',
    '⚠️',
  ],
  ['cooked', 'cooked', 'get autobanned.', 'moderation', 'shame', '🔥'],
  [
    'survivor',
    'survivor',
    'serve a ban and come back.',
    'moderation',
    'silver',
    '🛡️',
  ],
  [
    'actually_went_touch_grass',
    'actually went touch grass',
    'return after 7 days away.',
    'moderation',
    'bronze',
    '🌿',
  ],
  [
    'first_rule',
    'first rule',
    'type the first rule.',
    'secret',
    'secret',
    '❔',
  ],
  [
    'night_owl',
    'night owl',
    'send a message between 3 and 4 a.m.',
    'secret',
    'secret',
    '❔',
  ],
  [
    'appeal_denied',
    'appeal denied',
    'press appeal 10 times.',
    'secret',
    'secret',
    '❔',
  ],
].map(([key, name, description, category, tier, icon]) => ({
  key,
  name,
  description,
  category,
  tier,
  icon,
})) as readonly AchievementDef[];

export const SECRET_ACHIEVEMENTS = new Set([
  'found_the_basement',
  'first_rule',
  'appeal_denied',
  'night_owl',
]);
