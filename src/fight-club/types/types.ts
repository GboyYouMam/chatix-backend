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
}

export type FightStatus = 'fighting' | 'fight_over' | 'lobby';

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
