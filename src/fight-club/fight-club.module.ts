import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { FightClubGateway } from './fight-club.gateway';
import { FightClubService } from './fight-club.service';
import { FightClubRepository } from './fight-club.repository';

@Module({
    imports: [
        JwtModule.registerAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                secret: configService.getOrThrow<string>('JWT_SECRET'),
            }),
        }),
    ],
    providers: [FightClubGateway, FightClubService, FightClubRepository],
})
export class FightClubModule {}
