import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from '../auth/users.repository';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [UsersController],
  exports: [UsersService, UsersRepository],
  providers: [UsersService, UsersRepository]
})
export class UsersModule {}