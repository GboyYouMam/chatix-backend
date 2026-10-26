import { IsString, Length } from 'class-validator';

export class RejectRoomDTO {
  @IsString()
  @Length(1, 200)
  reason: string;
}
