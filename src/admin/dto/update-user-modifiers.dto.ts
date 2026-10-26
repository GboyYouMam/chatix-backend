import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateUserModifiersDTO {
  @IsOptional()
  @IsBoolean()
  canChangeProfile?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(100)
  forcedTitle?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  bannedUntil?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  yapCooldown?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  banReason?: string | null;

  @IsOptional()
  @IsInt()
  @Min(-1_000_000)
  @Max(1_000_000)
  auraDelta?: number;

  @IsOptional()
  @IsInt()
  @Min(-1_000_000)
  @Max(1_000_000)
  debtDelta?: number;

  @IsOptional()
  @IsBoolean()
  isMogged?: boolean;

  @IsOptional()
  @IsBoolean()
  isClown?: boolean;

  @IsOptional()
  @IsBoolean()
  adminGlazeMode?: boolean;
}
