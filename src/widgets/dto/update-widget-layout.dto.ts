import { ArrayMaxSize, IsArray, IsString, MaxLength } from 'class-validator';
import { MAX_WIDGET_LAYOUT } from '../widget-catalog';

export class UpdateWidgetLayoutDto {
  @IsArray()
  @ArrayMaxSize(MAX_WIDGET_LAYOUT)
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  layout: string[];
}
