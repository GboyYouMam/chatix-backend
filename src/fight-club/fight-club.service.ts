import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JoinFightPayload, MatchState, PlayerState } from './types/types';
import { FightClubRepository } from './fight-club.repository';

@Injectable()
export class FightClubService {
    private activeMatches = new Map<string, MatchState>();
    public server: Server;
    private logger = new Logger('FightClubService');

    constructor(private readonly fightClubRepository: FightClubRepository) {}

    private getRandomKey(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        return chars.charAt(Math.floor(Math.random() * chars.length));
    }

    joinMatch(client: Socket, payload: JoinFightPayload) {
        let match = this.activeMatches.get(payload.matchId);

        if (!match) {
            if (!payload.opponentId) {
                client.emit('fight:error', { message: 'Missing opponent' });
                return false;
            }

            match = {
                matchId: payload.matchId,
                player1: this.createPlayer(payload.userId, client.id),
                player2: this.createPlayer(payload.opponentId, ''),
                currentKey: '',
                stakeType: payload.stakeType ?? 'aura',
                stakeAmount: payload.stakeAmount ?? 0,
                status: 'lobby',
            };
            this.activeMatches.set(payload.matchId, match);
        }

        if (match.player1.id !== payload.userId && match.player2.id !== payload.userId) {
            client.emit('fight:error', { message: 'You are not in this fight' });
            return false;
        }

        if (match.player1.id === payload.userId) match.player1.socketId = client.id;
        if (match.player2.id === payload.userId) match.player2.socketId = client.id;

        if (match.status === 'lobby' && match.player1.socketId && match.player2.socketId) {
            this.startMatch(payload.matchId);
        }

        return true;
    }

    async handleHit(client: Socket, matchId: string, userId: string, pressedKey: string) {
        const match = this.activeMatches.get(matchId);
        if (!match || match.status !== 'fighting') {
            client.emit('fight:error', {
                message: 'My fav what are u trying to do? This match not even existing gah dayum',
            });
            return;
        }

        const isPlayer1 = match.player1.id === userId;
        if (!isPlayer1 && match.player2.id !== userId) return;

        const player = isPlayer1 ? match.player1 : match.player2;
        const enemy = isPlayer1 ? match.player2 : match.player1;

        const now = Date.now();

        if (now < player.stunnedUntil) return;

        if (pressedKey.toUpperCase() !== match.currentKey) {
            player.stunnedUntil = now + 1000;
            player.combo = 0;

            client.emit('fight:stun', { stunDuration: 1000 });
            return;
        }

        player.combo += 1;
        enemy.combo = 0;
        let damage = 1;
        let isCrit = false;

        if (player.combo === 3) {
            damage = 5;
            isCrit = true;
            player.combo = 0;
        }

        enemy.hp = Math.max(0, enemy.hp - damage);

        if (enemy.hp === 0) {
            match.status = 'fight_over';
            await this.finishMatch(match, player.id, enemy.id);
            return;
        }

        match.currentKey = this.getRandomKey();

        this.server.to(matchId).emit('fight:update', {
            p1Hp: match.player1.hp,
            p2Hp: match.player2.hp,
            p1Combo: match.player1.combo,
            p2Combo: match.player2.combo,
            nextKey: match.currentKey,
            isCrit,
            damage,
            attackerId: player.id,
        });
    }

    private async finishMatch(match: MatchState, winnerId: string, loserId: string) {
        const { stakeType, stakeAmount, matchId } = match;
        try {
            await this.fightClubRepository.summariseFight(
                winnerId,
                loserId,
                stakeType,
                stakeAmount,
            );
            this.server.to(matchId).emit('fight:game_over', {
                winnerId,
                loserId,
                stakeType,
                stakeAmount,
            });
        } catch (e) {
            this.logger.error(e);
        } finally {
            this.activeMatches.delete(matchId);
        }
    }

    async handlePlayerDisconnect(userId: string) {
        for (const [matchId, match] of this.activeMatches.entries()) {
            if (
                match.status === 'lobby' &&
                (match.player1.id === userId || match.player2.id === userId)
            ) {
                this.activeMatches.delete(matchId);
                this.server.to(matchId).emit('fight:cancelled', { reason: 'opponent_left' });
            }

            if (match.status === 'fighting') {
                if (match.player1.id === userId || match.player2.id === userId) {
                    const isPlayer1 = match.player1.id === userId;

                    const loserId = userId;
                    const winnerId = isPlayer1 ? match.player2 : match.player1;

                    this.server.to(matchId).emit('fight:rage_quit', {
                        leaverId: loserId,
                        message: 'Opponent disconnected. FLAAAWLESS VICTORY.',
                    });

                    match.status = 'fight_over';
                    await this.finishMatch(match, winnerId.id, loserId);
                    return;
                }
            }
        }
    }

    private createPlayer(id: string, socketId: string): PlayerState {
        return { id, socketId, hp: 30, combo: 0, stunnedUntil: 0 };
    }

    startMatch(matchId: string) {
        const match = this.activeMatches.get(matchId);
        if (match && match.status === 'lobby') {
            match.currentKey = this.getRandomKey();
            match.status = 'fighting';
            this.server.to(matchId).emit('fight:start', { firstKey: match.currentKey });
        }
    }
}
