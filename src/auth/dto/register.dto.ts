import { IsString, Matches } from 'class-validator';
import { PASSWORD_REGEX, USERNAME_REGEX } from '../auth.constants';

export class RegisterDto {
  @IsString()
  @Matches(USERNAME_REGEX, {
    message:
      'username: 3-25 chars, letters, digits, _ or -. keep it simple, chud',
  })
  username!: string;

  @IsString()
  @Matches(PASSWORD_REGEX, {
    message:
      'password too weak: 8+ chars with upper, lower, digit and one of @$!%*?&',
  })
  password!: string;
}
