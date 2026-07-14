export type StakeVaries = 'aura' | 'debt';

export interface JoinFightPayload {
  matchId: string;
  userId: string;
  opponentId?: string;
  stakeType?: StakeVaries;
  stakeAmount?: number;
}

export interface PlayerState {
  id: string;
  socketId: string;
  hp: number;
  combo: number;
  stunnedUntil: number;
  lastHitAt: number;
}
export const FightStatus = {
  FIGHTING: 'fighting',
  FIGHT_OVER: 'fight_over',
  LOBBY: 'lobby',
} as const;
export type FightStatus = keyof typeof FightStatus;

export interface MatchState {
  matchId: string;
  player1: PlayerState;
  player2: PlayerState;
  currentKey: string;
  stakeType: StakeVaries;
  stakeAmount: number;
  status: FightStatus;
}

export interface FightJwtPayload {
  sub: string;
  username: string;
  role: string;
}
