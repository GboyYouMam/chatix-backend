import { IsNotEmpty, IsString } from 'class-validator';

export class CreateMessageDTO {
    @IsString()
    @IsNotEmpty()
    roomId: string;

    @IsString()
    @IsNotEmpty()
    cipherText: string;
}

export class RequestUser {
    userId: string;
    username: string;
    role: string;
}