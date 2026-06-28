import {IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength} from "class-validator";

export class CreateRoomDTO {
    @IsString({ message: 'Title must be a string' })
    @IsNotEmpty({ message: 'How do u expect Title to be an empty, are we deadass?' })
    @MaxLength(255, { message: 'Title must be max of 255 characters long' })
    title: string;

    @IsString({ message: 'Topic must be a string' })
    @IsOptional()
    @MaxLength(255, { message: 'Topic must be max of 255 characters long' })
    topic?: string;

    @IsString({ message: 'Description must be a string' })
    @IsOptional()
    description?: string;

    @IsString({ message: 'Password must be a string' })
    @IsOptional()
    password?: string;

    @IsEnum(['public', 'private'], { message: 'Publicity must be strictly public or private lmao' })
    @IsNotEmpty({ message: 'Publicity must be specified' })
    publicity: 'public' | 'private';
}

export class RequestUser {
    userId: string;
    username: string;
    role: string;
}