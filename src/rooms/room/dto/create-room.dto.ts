export class CreateRoomDto {
    title: string;
    topic?: string;
    description?: string;
}

export interface RequestUser {
    userId: string;
    username: string;
    role: string;
}