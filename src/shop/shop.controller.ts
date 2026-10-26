import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequestUser } from '../auth/dto/request-user.dto';
import { EquipDto } from './dto/equip.dto';
import { PurchaseDto } from './dto/purchase.dto';
import { ShopService } from './shop.service';

@Controller('shop')
export class ShopController {
  constructor(private readonly shop: ShopService) {}

  @Get('catalog')
  catalog() {
    return this.shop.listCatalog();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return this.shop.getMe(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('purchase')
  purchase(@CurrentUser() user: RequestUser, @Body() body: PurchaseDto) {
    return this.shop.purchase(user.userId, body.itemKey);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('equip')
  equip(@CurrentUser() user: RequestUser, @Body() body: EquipDto) {
    return this.shop.equip(user.userId, body.slot, body.itemKey);
  }
}
