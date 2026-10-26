import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { StorageModule } from './storage/storage.module';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RoomsModule } from './rooms/room/room.module';
import { MessagesModule } from './messages/messages.module';
import { FightClubModule } from './fight-club/fight-club.module';
import { DatabaseModule } from './database/database.module';
import { validateEnv } from './config/env.validation';
import { LoggingModule } from './logging/logging.module';
import { RealtimeModule } from './realtime/realtime.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggingModule,
    RealtimeModule,
    DatabaseModule,
    AdminModule,
    StorageModule,
    AuthModule,
    UsersModule,
    RoomsModule,
    MessagesModule,
    FightClubModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
