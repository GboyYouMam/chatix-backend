import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { StorageModule } from './storage/storage.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [AdminModule, StorageModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
