import { IsUUID } from 'class-validator';

export class FightJoinDto {
  @IsUUID()
  matchId: string;
}
