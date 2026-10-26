import { randomInt, randomUUID } from 'node:crypto';
import type { FightPrompt } from './types/types';

export const MIN_REACTION_MS = 120;
export const STUN_MS = 1000;
export const HIT_COOLDOWN_MS = 150;

const KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function createPrompt(now: number, previousKey?: string): FightPrompt {
  const choices = previousKey ? KEYS.replace(previousKey, '') : KEYS;
  return {
    promptId: randomUUID(),
    key: choices[randomInt(choices.length)],
    sentAt: now,
  };
}

export function toPublicPrompt(prompt: FightPrompt): {
  promptId: string;
  key: string;
} {
  return { promptId: prompt.promptId, key: prompt.key };
}
