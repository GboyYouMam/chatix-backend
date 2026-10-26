import { Module } from '@nestjs/common';
import { ConsumablesService } from './consumables.service';
import { CosmeticsService } from './cosmetics.service';
import { ProfileEffectsService } from './profile-effects.service';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';

@Module({
  controllers: [ShopController],
  providers: [
    ShopService,
    CosmeticsService,
    ConsumablesService,
    ProfileEffectsService,
  ],
  exports: [ShopService, CosmeticsService, ProfileEffectsService],
})
export class ShopModule {}
