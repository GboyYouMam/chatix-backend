import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersRepository } from '../users/users.repository';
import { PASSWORD_REGEX, USERNAME_REGEX } from './auth.constants';
import { BannedException } from '../common/errors/banned.exception';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly userRepository: UsersRepository,
    private readonly jwtService: JwtService,
  ) {}
  private generateToken(
    userId: string,
    username: string,
    role: 'user' | 'admin',
    tv = 0,
  ) {
    return {
      access_token: this.jwtService.sign({ sub: userId, username, role, tv }),
    };
  }
  async register(username: string, password: string) {
    if (!USERNAME_REGEX.test(username))
      throw new UnauthorizedException('Invalid username');
    if (!PASSWORD_REGEX.test(password))
      throw new UnauthorizedException('Invalid password');
    if (await this.userRepository.findByUsername(username))
      throw new ConflictException('Username already exists');
    const passwordHash = await bcrypt.hash(password, await bcrypt.genSalt(10));
    const user = await this.userRepository.create(username, passwordHash);
    this.logger.log({ event: 'auth.register', userId: user.id });
    return this.generateToken(
      user.id,
      user.username,
      user.role,
      user.tokenVersion,
    );
  }
  async login(username: string, password: string) {
    const user = await this.userRepository.findByUsername(username);
    if (!user) {
      this.logger.warn({
        event: 'auth.login.failed',
        username,
        reason: 'no_user',
      });
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!(await bcrypt.compare(password, user.password))) {
      this.logger.warn({
        event: 'auth.login.failed',
        username,
        reason: 'bad_password',
      });
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.bannedUntil && user.bannedUntil > new Date()) {
      this.logger.warn({
        event: 'auth.login.failed',
        username,
        reason: 'banned',
      });
      throw new BannedException(user.bannedUntil, user.banReason);
    }
    this.logger.log({ event: 'auth.login.success', userId: user.id });
    return this.generateToken(
      user.id,
      user.username,
      user.role,
      user.tokenVersion,
    );
  }
}
