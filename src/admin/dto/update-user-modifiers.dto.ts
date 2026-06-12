import { IsBoolean, IsInt, IsOptional, IsString, IsDateString, MaxLength } from 'class-validator';

export class UpdateUserModifiersDTO {
    @IsOptional()
    @IsInt({ message: 'Warns count must be an integer' })
    warnsCount?: number;

    @IsOptional()
    @IsBoolean()
    canChangeProfile?: boolean;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    forcedTitle?: string;

    @IsOptional()
    @IsDateString()
    bannedUntil?: string;

    @IsOptional()
    @IsDateString()
    yapCooldown?: string;

    @IsOptional()
    @IsInt()
    aura?: number;

    @IsOptional()
    @IsBoolean()
    isMogged?: boolean;

    @IsOptional()
    @IsBoolean()
    isClown?: boolean;

    @IsOptional()
    @IsBoolean()
    adminGlazeMode?: boolean;

    @IsOptional()
    @IsInt()
    debt?: number;
}