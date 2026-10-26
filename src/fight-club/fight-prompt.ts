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

export function isSuspiciousCadence(timestamps: number[]): boolean {
  if (timestamps.length < 11) return false;
  const recent = timestamps.slice(-11);
  const intervals = recent
    .slice(1)
    .map((timestamp, index) => timestamp - recent[index]);
  const mean = intervals.reduce((sum, interval) => sum + interval, 0) / 10;
  const variance =
    intervals.reduce((sum, interval) => sum + (interval - mean) ** 2, 0) / 10;
  return Math.sqrt(variance) < 15;
}
