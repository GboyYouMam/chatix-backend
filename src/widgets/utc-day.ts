export function utcDay(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
