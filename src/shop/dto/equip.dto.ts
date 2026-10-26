import { IsIn, IsString, MaxLength, ValidateIf } from 'class-validator';
import { EQUIP_SLOTS } from '../equipment';

export class EquipDto {
  @IsIn([...EQUIP_SLOTS])
  slot: (typeof EQUIP_SLOTS)[number];

  // null unequips; anything else must be a string item key.
  @ValidateIf((dto: EquipDto) => dto.itemKey !== null)
  @IsString()
  @MaxLength(48)
  itemKey: string | null;
}
