import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { and, count, eq, inArray } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DB_CONNECTION } from '../database/database.module';
import * as schema from '../database/scheme';
import { RealtimeService } from '../realtime/realtime.service';
import { ACHIEVEMENTS, SECRET_ACHIEVEMENTS } from './catalog';

export type AchievementTrigger =
  | 'aura'
  | 'debt'
  | 'fight'
  | 'message'
  | 'room_status'
  | 'respect'
  | 'warn'
  | 'ban'
  | 'login';

@Injectable()
export class AchievementsService {
  private readonly logger = new Logger(AchievementsService.name);

  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly realtime: RealtimeService,
  ) {}

  async grant(userId: string, key: string): Promise<boolean> {
    if (!ACHIEVEMENTS.some((item) => item.key === key)) return false;
    const [unlocked] = await this.db
      .insert(schema.userAchievements)
      .values({ userId, key })
      .onConflictDoNothing()
      .returning({ key: schema.userAchievements.key });
    if (!unlocked) return false;
    this.realtime.emitToUser(userId, 'achievement:unlocked', { key });
    return true;
  }

  async grantSafely(userId: string, key: string) {
    try {
      return await this.grant(userId, key);
    } catch (error) {
      this.logger.error({
        event: 'achievement.grant_failed',
        userId,
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async evaluate(userId: string, trigger: AchievementTrigger) {
    try {
      const user = await this.db.query.users.findFirst({
        where: eq(schema.users.id, userId),
      });
      if (!user) return;
      const keys: string[] = [];
      if (trigger === 'aura') {
        if (user.auraFarmCount > 0) keys.push('first_farm');
        if (user.auraFarmCount >= 1000) keys.push('aura_farmer');
        if (user.aura >= 10000) keys.push('aura_god');
        if (user.aura < 0) keys.push('in_the_negatives');
        if (user.aura <= -1000) keys.push('bankrupt_vibes');
      }
      if (trigger === 'debt') {
        if (user.debt > 0) keys.push('first_debt');
        if (user.debt < 0) keys.push('financial_cushion');
        if (user.debt <= -1000) keys.push('loan_shark');
        if (user.debt >= 1000) keys.push('debt_lord');
      }
      if (trigger === 'fight') {
        if (user.fightsWon > 0) keys.push('first_blood');
        if (user.fightsWon + user.fightsLost >= 10)
          keys.push('basement_regular');
        if (user.winStreak >= 5) keys.push('undefeated');
        if (user.lossStreak >= 10) keys.push('professionally_mogged');
      }
      if (trigger === 'message') {
        if (user.messagesCount >= 100) keys.push('yapper');
        if (user.messagesCount >= 1000) keys.push('certified_yapper');
      }
      if (trigger === 'respect') {
        if (user.respectCount >= 10) keys.push('respected');
        if (user.respectCount >= 100) keys.push('glazed');
      }
      if (trigger === 'warn' && user.warnsCount > 0) keys.push('first_warn');
      if (trigger === 'ban' && user.autoBannedAt) keys.push('cooked');
      if (
        trigger === 'login' &&
        user.lastSeenAt &&
        Date.now() - user.lastSeenAt.getTime() >= 7 * 86400000
      ) {
        keys.push('actually_went_touch_grass');
      }
      await Promise.all(keys.map((key) => this.grantSafely(userId, key)));
    } catch (error) {
      this.logger.error({
        event: 'achievement.evaluate_failed',
        userId,
        trigger,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async listCatalog(userId?: string) {
    const counts = await this.db
      .select({ key: schema.userAchievements.key, total: count() })
      .from(schema.userAchievements)
      .groupBy(schema.userAchievements.key);
    const unlocked = userId
      ? await this.db.query.userAchievements.findMany({
          where: eq(schema.userAchievements.userId, userId),
          columns: { key: true },
        })
      : [];
    const percentages = new Map(counts.map(({ key, total }) => [key, total]));
    const userKeys = new Set(unlocked.map(({ key }) => key));
    const [{ totalUsers }] = await this.db
      .select({ totalUsers: count() })
      .from(schema.users);
    return ACHIEVEMENTS.map((item) => {
      const hidden =
        SECRET_ACHIEVEMENTS.has(item.key) && !userKeys.has(item.key);
      return {
        ...item,
        ...(hidden ? { name: '???', description: 'secret. go find it.' } : {}),
        unlockedPercent: totalUsers
          ? Math.round(
              ((percentages.get(item.key) ?? 0) / totalUsers) * 10000,
            ) / 100
          : 0,
      };
    });
  }

  async setFeatured(userId: string, keys: string[]) {
    if (keys.length > 3 || new Set(keys).size !== keys.length) {
      throw new BadRequestException('pick up to 3 different medals.');
    }
    const unlocked = await this.db.query.userAchievements.findMany({
      where: and(
        eq(schema.userAchievements.userId, userId),
        inArray(schema.userAchievements.key, keys.length ? keys : ['']),
      ),
      columns: { key: true },
    });
    if (unlocked.length !== keys.length) {
      throw new BadRequestException('you have not unlocked that medal yet.');
    }
    await this.db
      .update(schema.users)
      .set({ featuredAchievements: keys })
      .where(eq(schema.users.id, userId));
    return { featuredAchievements: keys };
  }

  async discover(userId: string, key: string) {
    if (!SECRET_ACHIEVEMENTS.has(key)) {
      throw new BadRequestException('that medal is not a secret.');
    }
    if (!(await this.grant(userId, key))) {
      const user = await this.db.query.users.findFirst({
        where: eq(schema.users.id, userId),
        columns: { id: true },
      });
      if (!user) throw new NotFoundException('no such chud.');
    }
    return { key };
  }
}
