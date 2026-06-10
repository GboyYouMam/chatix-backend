export class CreateMessageDTO {
    roomId: string;
    cipherText: string;
}

export interface RequestUser {
    userId: string;
    username: string;
    role: string;
}