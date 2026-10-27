export const WIDGET_KEYS = [
  'now_playing',
  'medal_rack',
  'aura_chart',
  'fight_record',
  'top_glazers',
  'debt_meter',
  'yap_stats',
  'guestbook',
  'status_line',
  'rap_sheet',
  'hit_counter',
  'wanted_poster',
] as const;

export type WidgetKey = (typeof WIDGET_KEYS)[number];

export const WIDGET_KEY_SET: ReadonlySet<string> = new Set(WIDGET_KEYS);

export const DEFAULT_WIDGET_LAYOUT: readonly WidgetKey[] = [
  'medal_rack',
  'fight_record',
  'debt_meter',
  'guestbook',
];

export const WANTED_POSTER_DEBT = 1000;

// Widgets that need a shop item. Owning any listed item unlocks the widget.
export const WIDGET_UNLOCK_ITEMS: Partial<
  Record<WidgetKey, readonly string[]>
> = {
  hit_counter: ['hit_counter'],
};

export const MAX_WIDGET_LAYOUT = WIDGET_KEYS.length;
