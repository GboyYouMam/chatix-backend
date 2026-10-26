import { IsString, IsUUID, Length } from 'class-validator';

export class FightHitDto {
  @IsUUID()
  matchId: string;

  @IsUUID()
  promptId: string;

  @IsString()
  @Length(1, 1)
  k: string;
}
