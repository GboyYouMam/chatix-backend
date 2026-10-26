import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileExtrasDto {
  // null clears the track. Validation happens in normalizeTrackUrl.
  @IsOptional()
  @IsString()
  @MaxLength(300)
  trackUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  statusText?: string | null;
}
