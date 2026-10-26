import { IsIn, IsInt, IsString, Length, Max, Min } from 'class-validator';

export class FightCreateDto {
  @IsString()
  @Length(1, 60)
  title: string;

  @IsIn(['aura', 'debt'])
  stakeType: 'aura' | 'debt';

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  stakeAmount: number;
}
