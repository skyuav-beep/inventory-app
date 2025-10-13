import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ActiveUser } from '../auth/decorators/active-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveUserData } from '../auth/types/active-user-data';
import { UpdateTelegramSettingsDto } from './dto/update-telegram-settings.dto';
import { SettingsService } from './settings.service';

@UseGuards(JwtAuthGuard)
@Controller('settings/notifications')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('telegram')
  async getTelegramSettings() {
    return this.settingsService.getTelegramSettings();
  }

  @Put('telegram')
  async updateTelegramSettings(
    @Body() payload: UpdateTelegramSettingsDto,
    @ActiveUser() activeUser: ActiveUserData,
  ) {
    return this.settingsService.updateTelegramSettings(payload, {
      updatedByUserId: activeUser.userId,
    });
  }
}
