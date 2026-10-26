import { IsEnum } from 'class-validator';

export class UpdateRoomStatusDto {
  @IsEnum(['active', 'checkout', 'banned', 'quarantined'])
  status: 'active' | 'checkout' | 'banned' | 'quarantined';
}
