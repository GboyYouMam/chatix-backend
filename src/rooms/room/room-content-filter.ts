// Weak keyword filter for room titles, topics and descriptions. It is not a
// moderation system: it only catches the obvious stuff so a human can look.

export type ContentVerdict = {
  verdict: 'ok' | 'mature' | 'blocked';
  matched: string | null;
};

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
};

function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[013457@$]/g, (char) => LEET[char])
    .replace(/[^a-z0-9+ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function termPattern(term: string): RegExp {
  const body = normalize(term).split(' ').map(escapeRegExp).join('\\s+');
  return new RegExp(`(?<![a-z0-9])${body}(?![a-z0-9])`);
}

const BUY_SELL = ['buy', 'buying', 'buys', 'sell', 'selling', 'sells'];
const TRADE_DRUGS = [
  'coke',
  'cocaine',
  'weed',
  'meth',
  'heroin',
  'mdma',
  'molly',
  'lsd',
  'xanax',
  'ketamine',
  'shrooms',
  'fentanyl',
];
const TRADE_GUNS = ['gun', 'guns', 'pistol', 'pistols', 'glock', 'rifle', 'rifles'];

const crossProduct = (verbs: string[], objects: string[]) =>
  verbs.flatMap((verb) => objects.map((object) => `${verb} ${object}`));

const BLOCKED_TERMS: string[] = [
  // child sexual content
  'cp',
  'child porn',
  'child porno',
  'pedo',
  'pedophile',
  'underage nudes',
  'underage porn',
  // drug trade
  ...crossProduct(BUY_SELL, TRADE_DRUGS),
  'drug plug',
  'dealer dm',
  // weapons trade
  ...crossProduct(BUY_SELL, TRADE_GUNS),
  'ghost gun',
  'ghost guns',
  // hire a killer
  'hitman',
  'hitmen',
  'hire a hitman',
  'hire a killer',
  // fraud
  'carding',
  'cvv shop',
  'fullz',
  // doxxing
  'dox',
  'doxx',
  'doxxing',
  // terror
  'join isis',
  'bomb making',
];

const MATURE_TERMS: string[] = [
  'drugs',
  'drug',
  'weed',
  'cannabis',
  'cocaine',
  'coke',
  'mdma',
  'molly',
  'lsd',
  'acid trip',
  'shrooms',
  'ketamine',
  'meth',
  'heroin',
  'xanax',
  'nsfw',
  'porn',
  'sex',
  'nudes',
  '18+',
  'onlyfans',
  'gore',
  'gambling',
  'casino',
  'alcohol',
  'booze',
];

const BLOCKED_PATTERNS = BLOCKED_TERMS.map((term) => ({
  term,
  pattern: termPattern(term),
}));
const MATURE_PATTERNS = MATURE_TERMS.map((term) => ({
  term,
  pattern: termPattern(term),
}));

export function classifyRoomText(
  ...parts: Array<string | null | undefined>
): ContentVerdict {
  const haystack = parts
    .map((part) => normalize(part ?? ''))
    .filter(Boolean)
    .join(' / ');
  if (!haystack) return { verdict: 'ok', matched: null };

  const blocked = BLOCKED_PATTERNS.find(({ pattern }) =>
    pattern.test(haystack),
  );
  if (blocked) return { verdict: 'blocked', matched: blocked.term };

  const mature = MATURE_PATTERNS.find(({ pattern }) => pattern.test(haystack));
  if (mature) return { verdict: 'mature', matched: mature.term };

  return { verdict: 'ok', matched: null };
}
