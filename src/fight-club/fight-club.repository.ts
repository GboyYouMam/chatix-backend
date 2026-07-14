import { Inject, Injectable } from '@nestjs/common';
import { DB_CONNECTION } from '../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as scheme from '../database/scheme';
import { StakeVaries } from './types/types';
import { eq, sql } from 'drizzle-orm';

@Injectable()
export class FightClubRepository {
    constructor(
        @Inject(DB_CONNECTION)
        private readonly db: PostgresJsDatabase<typeof scheme>,
    ) {}

    async summariseFight(
        winnerId: string,
        loserId: string,
        stakeType: StakeVaries,
        stakeAmount: number,
    ) {
        if (!Number.isInteger(stakeAmount) || stakeAmount <= 0) {
            throw new Error('Stake amount must be a positive integer');
        }

        await this.db.transaction(async (tx) => {
            switch (stakeType) {
                case 'aura': {
                    const winner = await tx
                        //winner
                        .update(scheme.users)
                        .set({
                            aura: sql`${scheme.users.aura} + ${stakeAmount}`,
                            forcedTitle: 'true adam',
                        })
                        .where(eq(scheme.users.id, winnerId))
                        .returning({ id: scheme.users.id });

                    if (winner.length !== 1) throw new Error('Winner not found');

                    const loser = await tx
                        //loser
                        .update(scheme.users)
                        .set({
                            aura: sql`${scheme.users.aura} - ${stakeAmount}`,
                            forcedTitle: 'sub5',
                        })
                        .where(eq(scheme.users.id, loserId))
                        .returning({ id: scheme.users.id });

                    if (loser.length !== 1) throw new Error('Loser not found');
                    break;
                }
                case 'debt': {
                    //winner
                    const winner = await tx
                        .update(scheme.users)
                        .set({
                            debt: sql`${scheme.users.debt} - ${stakeAmount}`,
                            forcedTitle: 'true adam',
                        })
                        .where(eq(scheme.users.id, winnerId))
                        .returning({ id: scheme.users.id });

                    if (winner.length !== 1) throw new Error('Winner not found');

                    //loser
                    const loser = await tx
                        .update(scheme.users)
                        .set({
                            debt: sql`${scheme.users.debt} + ${stakeAmount}`,
                            forcedTitle: 'sub5',
                        })
                        .where(eq(scheme.users.id, loserId))
                        .returning({ id: scheme.users.id });

                    if (loser.length !== 1) throw new Error('Loser not found');
                    break;
                }
                default:
                    throw new Error(`Unsupported stake type: ${stakeType}`);
            }
        });
    }
}
