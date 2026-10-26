import { IsString, Matches } from 'class-validator';
import { PASSWORD_REGEX, USERNAME_REGEX } from '../auth.constants';
export class RegisterDto {
  @IsString() @Matches(USERNAME_REGEX) username!: string;
  @IsString() @Matches(PASSWORD_REGEX) password!: string;
}
