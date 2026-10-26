import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequestUser } from '../auth/dto/request-user.dto';
import { UpdateWidgetLayoutDto } from './dto/update-widget-layout.dto';
import { UpdateProfileExtrasDto } from './dto/update-profile-extras.dto';
import { WidgetsService } from './widgets.service';

@UseGuards(JwtAuthGuard)
@Controller('users/me')
export class WidgetsController {
  constructor(private readonly widgets: WidgetsService) {}

  @Patch('widgets')
  async updateLayout(
    @CurrentUser() user: RequestUser,
    @Body() body: UpdateWidgetLayoutDto,
  ) {
    return this.widgets.updateLayout(user.userId, body.layout);
  }

  @Patch('profile-extras')
  async updateProfileExtras(
    @CurrentUser() user: RequestUser,
    @Body() body: UpdateProfileExtrasDto,
  ) {
    return this.widgets.updateProfileExtras(user.userId, body);
  }
}
