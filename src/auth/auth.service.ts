import { Injectable, Inject, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { DB_CONNECTION } from '../database/database.module';
import * as schema from '../database/scheme';

const PASS_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,25}$/;;

@Injectable()
export class AuthService {
    constructor(
        @Inject(DB_CONNECTION) private readonly db: any,
        private jwtService: JwtService,
    ) {}

    private generateToken(userId: string, username: string, role: string) {
        const payload = { sub: userId, username, role };
        return {
            access_token: this.jwtService.sign(payload),
        };
    }
    async register(username: string, password: string) {
        if (!USERNAME_REGEX.test(username)) {
            throw new UnauthorizedException('Invalid username');
        }
        if (!PASS_REGEX.test(password)) {
            throw new UnauthorizedException('Invalid password');
        }

        const existingUser = await this.db.query.users.findFirst({
        where: eq(schema.users.username, username),
        });
        if (existingUser) {
            throw new ConflictException('Username already exists');
        }

        const saltForPassword = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, saltForPassword);

        const [newUser] = await this.db.insert(schema.users).values({
            username,
            password: hashedPassword,
        }).returning();

        return this.generateToken(newUser.id, newUser.username, newUser.role);
    }

    async login(username: string, password: string) {
        const user = await this.db.query.users.findFirst({
            where: eq(schema.users.username, username),
        });
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        return this.generateToken(user.id, user.username, user.role);
    }
}