import { createPrompt, isSuspiciousCadence } from './fight-prompt';

describe('fight prompts', () => {
  it('uses a fresh prompt id and never repeats the previous key', () => {
    const ids = new Set<string>();
    for (let index = 0; index < 1000; index += 1) {
      const prompt = createPrompt(0, 'A');
      ids.add(prompt.promptId);
      expect(prompt.key).not.toBe('A');
    }
    expect(ids.size).toBe(1000);
  });

  it('flags ten consistently spaced hit intervals', () => {
    expect(
      isSuspiciousCadence(Array.from({ length: 11 }, (_, i) => i * 200)),
    ).toBe(true);
  });

  it('ignores variable cadence and fewer than ten intervals', () => {
    const intervals = [180, 260, 210, 190, 240, 160, 230, 170, 250, 200];
    const timestamps = intervals.reduce<number[]>(
      (values, interval) => [...values, (values.at(-1) ?? 0) + interval],
      [0],
    );
    expect(isSuspiciousCadence(timestamps)).toBe(false);
    expect(
      isSuspiciousCadence(Array.from({ length: 10 }, (_, i) => i * 200)),
    ).toBe(false);
  });
});
