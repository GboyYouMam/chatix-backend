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
        await this.db.transaction(async (tx) => {
            switch (stakeType) {
                case 'aura':
                    await tx
                        //winner
                        .update(scheme.users)
                        .set({
                            aura: sql`${scheme.users.aura} + ${stakeAmount}`,
                            forcedTitle: 'true adam',
                        })
                        .where(eq(scheme.users.id, winnerId));

                    await tx
                        //loser
                        .update(scheme.users)
                        .set({
                            aura: sql`${scheme.users.aura} - ${stakeAmount}`,
                            forcedTitle: 'sub5',
                        })
                        .where(eq(scheme.users.id, loserId));
                    break;
                case 'debt':
                    //winner
                    await tx
                        .update(scheme.users)
                        .set({
                            debt: sql`${scheme.users.debt} - ${stakeAmount}`,
                            forcedTitle: 'true adam',
                        })
                        .where(eq(scheme.users.id, winnerId));
                    //loser
                    await tx
                        .update(scheme.users)
                        .set({
                            debt: sql`${scheme.users.debt} + ${stakeAmount}`,
                            forcedTitle: 'sub5',
                        })
                        .where(eq(scheme.users.id, loserId));
                    break;
            }
        });
    }
}
