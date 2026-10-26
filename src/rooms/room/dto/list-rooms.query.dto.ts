import { IsIn, IsOptional } from 'class-validator';

export class ListRoomsQueryDto {
  @IsOptional()
  @IsIn(['public', 'private'])
  publicity?: 'public' | 'private';
}
