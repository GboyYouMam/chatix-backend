import { Module } from '@nestjs/common';
import { FightClubGateway } from './fight-club.gateway';
import { FightClubService } from './fight-club.service';
import { FightClubRepository } from './fight-club.repository';

@Module({
    providers: [FightClubGateway, FightClubService, FightClubRepository],
})
export class FightClubModule {}
