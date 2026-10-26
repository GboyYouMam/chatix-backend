import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateMessageDTO {
  @IsUUID()
  @IsNotEmpty()
  roomId: string;

  @IsString()
  @IsOptional()
  cipherText: string;
}
