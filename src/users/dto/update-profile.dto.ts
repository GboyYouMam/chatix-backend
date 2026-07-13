import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
    @IsOptional()
    @IsString()
    @MaxLength(50)
    vibe?: string;

    @IsOptional()
    @IsString()
    @MaxLength(300)
    description?: string;

    @IsOptional()
    @IsString()
    username?: string;

    @IsOptional()
    file?: any;

    @IsOptional()
    upper_banner?: any;

    @IsOptional()
    left_banner?: any;

    @IsOptional()
    right_banner?: any;
}