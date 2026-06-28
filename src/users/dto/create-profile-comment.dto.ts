import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateProfileCommentDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(500)
    body: string;
}
