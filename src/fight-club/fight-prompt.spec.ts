import { createPrompt, toPublicPrompt } from './fight-prompt';

describe('fight prompts', () => {
  it('uses a fresh prompt id and never repeats the previous key', () => {
    for (let index = 0; index < 1000; index += 1) {
      const prompt = createPrompt(0, 'A');
      expect(prompt.promptId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(prompt.key).not.toBe('A');
    }
  });

  it('does not expose the server timestamp', () => {
    const prompt = toPublicPrompt(createPrompt(123));
    expect(Object.keys(prompt).sort()).toEqual(['key', 'promptId']);
    expect(typeof prompt.promptId).toBe('string');
    expect(typeof prompt.key).toBe('string');
  });
});
