import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { randomUUID } from 'node:crypto';
import { FightHitDto } from './dto/fight-hit.dto';
import {
  createPrompt,
  HIT_COOLDOWN_MS,
  isSuspiciousCadence,
  MIN_REACTION_MS,
  STUN_MS,
  toPublicPrompt,
} from './fight-prompt';
import {
  CreateFightPayload,
  FightChallenge,
  JoinFightPayload,
  MatchState,
  PlayerState,
  FightUpdate,
  HitResult,
} from './types/types';
import { FightClubRepository } from './fight-club.repository';

@Injectable()
export class FightClubService {
  private activeMatches = new Map<string, MatchState>();
  private suspiciousCadenceLogged = new Set<string>();
  public server: Server;
  private logger = new Logger('FightClubService');

  constructor(private readonly fightClubRepository: FightClubRepository) {}

  createMatch(
    userId: string,
    username: string,
    payload: CreateFightPayload,
  ): FightChallenge | null {
    if (
      !Number.isInteger(payload.stakeAmount) ||
      payload.stakeAmount <= 0 ||
      (payload.stakeType && !['aura', 'debt'].includes(payload.stakeType))
    ) {
      return null;
    }

    const match: MatchState = {
      matchId: randomUUID(),
      title: payload.title?.trim() || 'nameless basement duel',
      creator: username,
      player1: this.createPlayer(userId, ''),
      player2: this.createPlayer('', ''),
      prompt: { promptId: '', key: '', sentAt: 0 },
      stakeType: payload.stakeType ?? 'aura',
      stakeAmount: payload.stakeAmount,
      status: 'LOBBY',
    };
    this.activeMatches.set(match.matchId, match);
    return this.toChallenge(match);
  }

  listChallenges() {
    return [...this.activeMatches.values()]
      .filter((match) => match.status === 'LOBBY' && !match.player2.id)
      .map((match) => this.toChallenge(match));
  }

  private toChallenge(match: MatchState): FightChallenge {
    return {
      id: match.matchId,
      creatorId: match.player1.id,
      creator: match.creator,
      title: match.title,
      stakeType: match.stakeType,
      stakeAmount: match.stakeAmount,
    };
  }

  joinMatch(client: Socket, payload: JoinFightPayload) {
    let match = this.activeMatches.get(payload.matchId);

    if (!match) {
      if (!payload.opponentId) {
        client.emit('fight:error', { message: 'Missing opponent' });
        return false;
      }
      if (payload.opponentId === payload.userId) {
        client.emit('fight:error', {
          message:
            'dum why are u trying to fight urself? U think u are Tyler Durden?',
        });
        return false;
      }
      const stakeAmount = payload.stakeAmount;
      if (
        typeof stakeAmount !== 'number' ||
        !Number.isInteger(stakeAmount) ||
        stakeAmount <= 0
      ) {
        client.emit('fight:error', {
          message: 'Stake amount must be a positive integer',
        });
        return false;
      }

      match = {
        matchId: payload.matchId,
        title: 'basement duel',
        creator: payload.userId,
        player1: this.createPlayer(payload.userId, client.id),
        player2: this.createPlayer(payload.opponentId, ''),
        prompt: { promptId: '', key: '', sentAt: 0 },
        stakeType: payload.stakeType ?? 'aura',
        stakeAmount,
        status: 'LOBBY',
      };
      this.activeMatches.set(payload.matchId, match);
    }

    if (match.player2.id === '' && match.player1.id !== payload.userId) {
      match.player2 = this.createPlayer(payload.userId, client.id);
      this.server?.emit('fight:challenge_removed', { matchId: match.matchId });
    }

    if (
      match.player1.id !== payload.userId &&
      match.player2.id !== payload.userId
    ) {
      client.emit('fight:error', { message: 'You are not in this fight' });
      return false;
    }

    if (match.player1.id === payload.userId) match.player1.socketId = client.id;
    if (match.player2.id === payload.userId) match.player2.socketId = client.id;

    if (match.status === 'FIGHTING') {
      client.emit('fight:update', this.toUpdate(match));
    }

    return true;
  }

  async handleHit(
    userId: string,
    socketId: string,
    dto: FightHitDto,
    now: number,
  ): Promise<HitResult> {
    const match = this.activeMatches.get(dto.matchId);
    if (!match || match.status !== 'FIGHTING') {
      return { kind: 'rejected', reason: 'no_match' };
    }

    const isPlayer1 = match.player1.id === userId;
    if (!isPlayer1 && match.player2.id !== userId) {
      return { kind: 'rejected', reason: 'not_player' };
    }

    const player = isPlayer1 ? match.player1 : match.player2;
    const enemy = isPlayer1 ? match.player2 : match.player1;

    if (socketId !== player.socketId) {
      return { kind: 'rejected', reason: 'foreign_socket' };
    }
    if (now < player.stunnedUntil) {
      return { kind: 'rejected', reason: 'stunned' };
    }
    if (now - player.lastHitAt < HIT_COOLDOWN_MS) {
      return { kind: 'rejected', reason: 'cooldown' };
    }
    if (dto.promptId !== match.prompt.promptId) {
      return { kind: 'rejected', reason: 'stale_prompt' };
    }

    if (
      now - match.prompt.sentAt < MIN_REACTION_MS ||
      dto.k.toUpperCase() !== match.prompt.key
    ) {
      player.stunnedUntil = now + STUN_MS;
      player.combo = 0;
      return { kind: 'miss', stunMs: STUN_MS };
    }

    player.lastHitAt = now;
    player.hitTimestamps.push(now);
    if (player.hitTimestamps.length > 11) player.hitTimestamps.shift();
    const cadenceKey = `${dto.matchId}:${userId}`;
    if (
      !this.suspiciousCadenceLogged.has(cadenceKey) &&
      isSuspiciousCadence(player.hitTimestamps)
    ) {
      this.suspiciousCadenceLogged.add(cadenceKey);
      this.logger.warn(
        JSON.stringify({
          event: 'fight.suspicious_cadence',
          matchId: dto.matchId,
          userId,
        }),
      );
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
      match.status = 'FIGHT_OVER';
      await this.finishMatch(match, player.id, enemy.id);
      return { kind: 'ko', update: this.toUpdate(match), winnerId: player.id };
    }

    match.prompt = createPrompt(now, match.prompt.key);
    const update = this.toUpdate(match);
    update.isCrit = isCrit;
    update.damage = damage;
    update.attackerId = player.id;
    return { kind: 'hit', update };
  }

  private async finishMatch(
    match: MatchState,
    winnerId: string,
    loserId: string,
  ) {
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
      this.suspiciousCadenceLogged.delete(`${matchId}:${match.player1.id}`);
      this.suspiciousCadenceLogged.delete(`${matchId}:${match.player2.id}`);
    }
  }

  async handlePlayerDisconnect(userId: string, socketId: string) {
    for (const [matchId, match] of this.activeMatches.entries()) {
      if (
        match.status === 'LOBBY' &&
        ((match.player1.id === userId && match.player1.socketId === socketId) ||
          (match.player2.id === userId && match.player2.socketId === socketId))
      ) {
        this.activeMatches.delete(matchId);
        this.server?.emit('fight:challenge_removed', { matchId });
        this.server?.to(matchId).emit('fight:cancelled', {
          reason: 'opponent_left',
        });
      }

      if (match.status === 'FIGHTING') {
        if (
          (match.player1.id === userId && match.player1.socketId === socketId) ||
          (match.player2.id === userId && match.player2.socketId === socketId)
        ) {
          const isPlayer1 = match.player1.id === userId;

          const loserId = userId;
          const winnerId = isPlayer1 ? match.player2 : match.player1;

          this.server.to(matchId).emit('fight:rage_quit', {
            leaverId: loserId,
            message: 'Opponent disconnected. FLAAAWLESS VICTORY.',
          });

          match.status = 'FIGHT_OVER';
          await this.finishMatch(match, winnerId.id, loserId);
          return;
        }
      }
    }
  }

  private createPlayer(id: string, socketId: string): PlayerState {
    return {
      id,
      username: '',
      socketId,
      hp: 30,
      combo: 0,
      stunnedUntil: 0,
      lastHitAt: 0,
      hitTimestamps: [],
    };
  }

  startMatch(matchId: string, now = Date.now()) {
    const match = this.activeMatches.get(matchId);
    if (
      match &&
      match.status === 'LOBBY' &&
      match.player1.socketId &&
      match.player2.id &&
      match.player2.socketId
    ) {
      match.prompt = createPrompt(now);
      match.status = 'FIGHTING';
      this.server
        .to(matchId)
        .emit('fight:start', {
          matchId,
          prompt: toPublicPrompt(match.prompt),
        });
    }
  }

  private toUpdate(match: MatchState): FightUpdate {
    return {
      matchId: match.matchId,
      hp: {
        [match.player1.id]: match.player1.hp,
        [match.player2.id]: match.player2.hp,
      },
      combo: {
        [match.player1.id]: match.player1.combo,
        [match.player2.id]: match.player2.combo,
      },
      prompt: toPublicPrompt(match.prompt),
    };
  }
}
