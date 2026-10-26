import { Module } from '@nestjs/common';
import { CosmeticsService } from './cosmetics.service';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';

@Module({
  controllers: [ShopController],
  providers: [ShopService, CosmeticsService],
  exports: [ShopService, CosmeticsService],
})
export class ShopModule {}
