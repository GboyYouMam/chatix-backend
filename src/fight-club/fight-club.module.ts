import { Module } from '@nestjs/common';
import { FightClubGateway } from './fight-club.gateway';
import { FightClubService } from './fight-club.service';
import { FightClubRepository } from './fight-club.repository';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [FightClubGateway, FightClubService, FightClubRepository],
})
export class FightClubModule {}
