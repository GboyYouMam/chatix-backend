import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { randomUUID } from 'node:crypto';
import { Server } from 'socket.io';
import { RequestUser } from '../auth/dto/request-user.dto';
import { FightClubRepository } from './fight-club.repository';
import { AchievementsService } from '../achievements/achievements.service';
import { FightCreateDto } from './dto/fight-create.dto';
import { FightHitDto } from './dto/fight-hit.dto';
import { FightJoinDto } from './dto/fight-join.dto';
import {
  createPrompt,
  HIT_COOLDOWN_MS,
  isSuspiciousCadence,
  MIN_REACTION_MS,
  STUN_MS,
  toPublicPrompt,
} from './fight-prompt';
import {
  FightChallenge,
  FightState,
  FightUpdate,
  HitResult,
  MatchState,
  PlayerState,
} from './types/types';

const LOBBY_GRACE_MS = 10_000;

@Injectable()
export class FightClubService implements OnModuleDestroy {
  private activeMatches = new Map<string, MatchState>();
  private lobbyGraceTimers = new Map<
    string,
    { timer: ReturnType<typeof setTimeout>; socketId: string }
  >();
  private suspiciousCadenceLogged = new Set<string>();
  public server: Server;
  private logger = new Logger('FightClubService');

  constructor(
    private readonly fightClubRepository: FightClubRepository,
    private readonly achievements: AchievementsService,
  ) {}

  onModuleDestroy() {
    for (const { timer } of this.lobbyGraceTimers.values()) clearTimeout(timer);
    this.lobbyGraceTimers.clear();
  }

  createMatch(
    user: RequestUser,
    socketId: string,
    payload: FightCreateDto,
  ): FightChallenge {
    const match: MatchState = {
      matchId: randomUUID(),
      title: payload.title.trim() || 'nameless basement duel',
      player1: this.createPlayer(user.userId, user.username, socketId),
      player2: this.createPlayer('', '', ''),
      prompt: { promptId: '', key: '', sentAt: 0 },
      stakeType: payload.stakeType,
      stakeAmount: payload.stakeAmount,
      status: 'LOBBY',
    };
    this.activeMatches.set(match.matchId, match);
    this.logger.log({
      event: 'fight.match.created',
      matchId: match.matchId,
      userId: user.userId,
    });
    return this.toChallenge(match);
  }

  listChallenges(): FightChallenge[] {
    return [...this.activeMatches.values()]
      .filter((match) => match.status === 'LOBBY' && !match.player2.id)
      .map((match) => this.toChallenge(match));
  }

  joinMatch(
    user: RequestUser,
    socketId: string,
    payload: FightJoinDto,
  ): FightState {
    const match = this.activeMatches.get(payload.matchId);
    if (!match) throw new WsException('match not found. it got cooked.');

    if (match.player1.id === user.userId) {
      match.player1.socketId = socketId;
      match.player1.joinedMatch = true;
      this.clearLobbyGrace(user.userId, match.matchId);
    } else if (match.player2.id === user.userId) {
      match.player2.socketId = socketId;
      match.player2.joinedMatch = true;
      this.clearLobbyGrace(user.userId, match.matchId);
    } else if (match.status === 'LOBBY' && !match.player2.id) {
      match.player2 = this.createPlayer(
        user.userId,
        user.username,
        socketId,
        true,
      );
      this.clearLobbyGrace(user.userId, match.matchId);
      this.server?.emit('fight:challenge_removed', { matchId: match.matchId });
    } else {
      throw new WsException('fight is full');
    }

    return this.toFightState(match, user.userId);
  }

  getFightState(userId: string, matchId: string): FightState | undefined {
    const match = this.activeMatches.get(matchId);
    if (
      !match ||
      (match.player1.id !== userId && match.player2.id !== userId)
    ) {
      return undefined;
    }
    return this.toFightState(match, userId);
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
      this.logger.warn({
        event: 'fight.suspicious_cadence',
        matchId: dto.matchId,
        userId,
      });
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
    match.prompt = createPrompt(now, match.prompt.key);
    const update = this.toUpdate(match);
    update.isCrit = isCrit;
    update.damage = damage;
    update.attackerId = player.id;

    if (enemy.hp === 0) {
      match.status = 'FIGHT_OVER';
      if (!(await this.finishMatch(match, player.id, enemy.id))) {
        return { kind: 'settlement_failed' };
      }
      return {
        kind: 'ko',
        update,
        winnerId: player.id,
        loserId: enemy.id,
        stakeType: match.stakeType,
        stakeAmount: match.stakeAmount,
      };
    }
    return { kind: 'hit', update };
  }

  private async finishMatch(
    match: MatchState,
    winnerId: string,
    loserId: string,
    emitGameOver = false,
    outcome: 'ko' | 'rage_quit' = 'ko',
  ): Promise<boolean> {
    const { stakeType, stakeAmount, matchId } = match;
    try {
      await this.fightClubRepository.settle(
        winnerId,
        loserId,
        stakeType,
        stakeAmount,
        { player1Id: match.player1.id, player2Id: match.player2.id },
        outcome,
      );
      await this.awardFightAchievements(match, winnerId, loserId, outcome);
      this.logger.log({
        event: 'fight.match.finished',
        matchId,
        winnerId,
        stakeType,
        stakeAmount,
      });
      if (emitGameOver) {
        this.server.to(matchId).emit('fight:game_over', {
          winnerId,
          loserId,
          stakeType,
          stakeAmount,
        });
      }
      return true;
    } catch (error: unknown) {
      this.logger.error({ event: 'fight.result_failed', matchId, err: error });
      this.server.to(matchId).emit('fight:error', {
        message: 'the soap cartel crashed. result not saved, try again.',
      });
      return false;
    } finally {
      this.activeMatches.delete(matchId);
      this.clearCadence(match);
    }
  }

  async handlePlayerDisconnect(userId: string, socketId: string) {
    for (const [matchId, match] of this.activeMatches.entries()) {
      const player = [match.player1, match.player2].find(
        (candidate) => candidate.id === userId,
      );
      if (!player || player.socketId !== socketId) continue;
      if (match.status === 'LOBBY') {
        player.joinedMatch = false;
        this.scheduleLobbyGrace(userId, matchId, socketId);
      } else if (match.status === 'FIGHTING') {
        const winner =
          match.player1.id === userId ? match.player2 : match.player1;
        this.logger.log({
          event: 'fight.match.rage_quit',
          matchId,
          leaverId: userId,
        });
        this.server.to(matchId).emit('fight:rage_quit', {
          leaverId: userId,
          message: 'Opponent disconnected. FLAAAWLESS VICTORY.',
        });
        match.status = 'FIGHT_OVER';
        await this.finishMatch(match, winner.id, userId, true, 'rage_quit');
        return;
      }
    }
  }

  startMatch(matchId: string, now = Date.now()) {
    const match = this.activeMatches.get(matchId);
    if (
      match &&
      match.status === 'LOBBY' &&
      match.player1.socketId &&
      match.player1.joinedMatch &&
      match.player2.id &&
      match.player2.socketId &&
      match.player2.joinedMatch
    ) {
      match.prompt = createPrompt(now);
      match.status = 'FIGHTING';
      this.logger.log({ event: 'fight.match.started', matchId });
      this.server.to(matchId).emit('fight:start', {
        matchId,
        prompt: toPublicPrompt(match.prompt),
      });
    }
  }

  private scheduleLobbyGrace(
    userId: string,
    matchId: string,
    socketId: string,
  ) {
    this.clearLobbyGrace(userId, matchId);
    const key = `${userId}:${matchId}`;
    const timer = setTimeout(() => {
      void this.expireLobbyChallenge(userId, matchId, socketId).catch(
        (error: unknown) => this.logger.error(error),
      );
    }, LOBBY_GRACE_MS);
    this.lobbyGraceTimers.set(key, { timer, socketId });
  }

  private async expireLobbyChallenge(
    userId: string,
    matchId: string,
    socketId: string,
  ) {
    const key = `${userId}:${matchId}`;
    if (this.lobbyGraceTimers.get(key)?.socketId !== socketId) return;
    this.lobbyGraceTimers.delete(key);
    const sockets = await this.server.in(`user:${userId}`).fetchSockets();
    if (sockets.length > 0) return;

    const match = this.activeMatches.get(matchId);
    const player = match
      ? [match.player1, match.player2].find(
          (candidate) => candidate.id === userId,
        )
      : undefined;
    if (match?.status !== 'LOBBY' || player?.socketId !== socketId) return;
    this.activeMatches.delete(matchId);
    this.clearCadence(match);
    this.server.emit('fight:challenge_removed', { matchId });
    this.server
      .to(matchId)
      .emit('fight:cancelled', { reason: 'opponent_left' });
    await this.fightClubRepository.recordCancelled({
      player1Id: match.player1.id,
      player2Id: match.player2.id || undefined,
      stakeType: match.stakeType,
      stakeAmount: match.stakeAmount,
    });
  }

  private async awardFightAchievements(
    match: MatchState,
    winnerId: string,
    loserId: string,
    outcome: 'ko' | 'rage_quit',
  ) {
    try {
      await Promise.all([
        this.achievements.evaluate(winnerId, 'fight'),
        this.achievements.evaluate(loserId, 'fight'),
        ...(match.stakeAmount >= 500
          ? [
              this.achievements.grantSafely(winnerId, 'high_roller'),
              this.achievements.grantSafely(loserId, 'high_roller'),
            ]
          : []),
      ]);
      if (await this.fightClubRepository.isClown(winnerId)) {
        await this.achievements.grantSafely(loserId, 'got_mogged_by_a_clown');
      }
      if (outcome === 'rage_quit') {
        await this.achievements.grantSafely(loserId, 'rage_quitter');
      }
      for (const userId of [winnerId, loserId]) {
        if ((await this.fightClubRepository.countRecentFights(userId)) >= 3) {
          await this.achievements.grantSafely(userId, 'the_soap_market');
        }
      }
      if (match.stakeType === 'aura') {
        await Promise.all([
          this.achievements.evaluate(winnerId, 'aura'),
          this.achievements.evaluate(loserId, 'aura'),
        ]);
      } else {
        await Promise.all([
          this.achievements.evaluate(winnerId, 'debt'),
          this.achievements.evaluate(loserId, 'debt'),
        ]);
      }
    } catch (error) {
      this.logger.error({
        event: 'achievement.fight_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private clearLobbyGrace(userId: string, matchId: string) {
    const key = `${userId}:${matchId}`;
    const pending = this.lobbyGraceTimers.get(key);
    if (pending) clearTimeout(pending.timer);
    this.lobbyGraceTimers.delete(key);
  }

  private clearCadence(match: MatchState) {
    this.suspiciousCadenceLogged.delete(`${match.matchId}:${match.player1.id}`);
    this.suspiciousCadenceLogged.delete(`${match.matchId}:${match.player2.id}`);
  }

  private toFightState(match: MatchState, userId: string): FightState {
    const creator = match.player1.id === userId;
    const you = creator ? match.player1 : match.player2;
    const opponent = creator ? match.player2 : match.player1;
    return {
      matchId: match.matchId,
      title: match.title,
      status:
        match.status === 'LOBBY'
          ? 'lobby'
          : match.status === 'FIGHTING'
            ? 'fighting'
            : 'fight_over',
      role: creator ? 'creator' : 'challenger',
      you: { id: you.id, username: you.username },
      opponent: opponent.id
        ? { id: opponent.id, username: opponent.username }
        : null,
      stakeType: match.stakeType,
      stakeAmount: match.stakeAmount,
    };
  }

  private toChallenge(match: MatchState): FightChallenge {
    return {
      id: match.matchId,
      creatorId: match.player1.id,
      creator: match.player1.username,
      title: match.title,
      stakeType: match.stakeType,
      stakeAmount: match.stakeAmount,
    };
  }

  private createPlayer(
    id: string,
    username: string,
    socketId: string,
    joinedMatch = false,
  ): PlayerState {
    return {
      id,
      username,
      socketId,
      joinedMatch,
      hp: 30,
      combo: 0,
      stunnedUntil: 0,
      lastHitAt: 0,
      hitTimestamps: [],
    };
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
