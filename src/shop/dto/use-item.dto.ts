import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { USABLE_ITEM_KEYS } from '../consumables.service';

export class UseItemDto {
  @IsString()
  @IsIn([...USABLE_ITEM_KEYS])
  itemKey: string;

  @IsOptional()
  @IsUUID()
  targetUserId?: string;

  @IsOptional()
  @IsUUID()
  roomId?: string;

  @IsOptional()
  @IsUUID()
  messageId?: string;
}
