import { IsIn, IsString } from 'class-validator';
import { SHOP_ITEMS } from '../catalog';

export class PurchaseDto {
  @IsString()
  @IsIn(SHOP_ITEMS.map((item) => item.key))
  itemKey: string;
}
