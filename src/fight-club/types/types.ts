export type StakeVaries = 'aura' | 'debt';

export interface FightChallenge {
  id: string;
  creatorId: string;
  creator: string;
  title: string;
  stakeType: StakeVaries;
  stakeAmount: number;
}

export interface PlayerState {
  id: string;
  username: string;
  socketId: string;
  joinedMatch: boolean;
  hp: number;
  combo: number;
  stunnedUntil: number;
  lastHitAt: number;
  hitTimestamps: number[];
}

export interface FightState {
  matchId: string;
  title: string;
  status: 'lobby' | 'fighting' | 'fight_over';
  role: 'creator' | 'challenger';
  you: { id: string; username: string };
  opponent: { id: string; username: string } | null;
  stakeType: StakeVaries;
  stakeAmount: number;
}

export interface FightPrompt {
  promptId: string;
  key: string;
  sentAt: number;
}

export interface FightUpdate {
  matchId: string;
  hp: Record<string, number>;
  combo: Record<string, number>;
  prompt: { promptId: string; key: string };
  isCrit?: boolean;
  damage?: number;
  attackerId?: string;
}

export type HitResult =
  | {
      kind: 'rejected';
      reason:
        | 'no_match'
        | 'not_player'
        | 'foreign_socket'
        | 'stale_prompt'
        | 'stunned'
        | 'cooldown';
    }
  | { kind: 'miss'; stunMs: number }
  | { kind: 'hit'; update: FightUpdate }
  | {
      kind: 'ko';
      update: FightUpdate;
      winnerId: string;
      loserId: string;
      stakeType: StakeVaries;
      stakeAmount: number;
    }
  | { kind: 'settlement_failed' };
export const FightStatus = {
  FIGHTING: 'fighting',
  FIGHT_OVER: 'fight_over',
  LOBBY: 'lobby',
} as const;
export type FightStatus = keyof typeof FightStatus;

export interface MatchState {
  matchId: string;
  title: string;
  player1: PlayerState;
  player2: PlayerState;
  prompt: FightPrompt;
  stakeType: StakeVaries;
  stakeAmount: number;
  status: FightStatus;
}
