import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { USERNAME_REGEX } from '../../auth/auth.constants';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  vibe?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @Matches(USERNAME_REGEX)
  username?: string;
}
