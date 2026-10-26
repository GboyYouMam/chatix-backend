import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateMessageDTO {
  @IsString()
  @IsNotEmpty()
  roomId: string;

  @IsString()
  @IsOptional()
  cipherText: string;
}
