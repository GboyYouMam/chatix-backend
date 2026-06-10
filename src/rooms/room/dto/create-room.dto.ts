export interface CreateRoomDTO {
    creatorId: string;
    title: string;
    topic?: string;
    description?: string;
    publicity: 'public' | 'private';
}

export interface RequestUser {
    userId: string;
    username: string;
    role: string;
}