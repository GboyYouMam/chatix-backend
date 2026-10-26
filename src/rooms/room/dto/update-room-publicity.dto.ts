import { IsEnum, IsString, MinLength, ValidateIf } from 'class-validator';

export class UpdateRoomPublicityDto {
  @IsEnum(['public', 'private'])
  publicity: 'public' | 'private';

  @ValidateIf((dto: UpdateRoomPublicityDto) => dto.publicity === 'private')
  @IsString()
  @MinLength(4)
  password?: string;
}
