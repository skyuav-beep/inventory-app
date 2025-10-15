import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ActiveUser } from '../auth/decorators/active-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveUserData } from '../auth/types/active-user-data';
import { AlertListQueryDto } from './dto/alert-query.dto';
import { SendCustomAlertDto } from './dto/send-custom-alert.dto';
import { AlertsService } from './alerts.service';

@UseGuards(JwtAuthGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  async findAll(@Query() query: AlertListQueryDto) {
    const page = query.page ?? 1;
    const size = query.size ?? 20;

    const result = await this.alertsService.findAll(query);

    return {
      data: result.data,
      page: {
        page,
        size,
        total: result.total,
      },
    };
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @Throttle({ alerts: { limit: 20, ttl: 60 } })
  async sendTest(@ActiveUser() activeUser: ActiveUserData) {
    const result = await this.alertsService.sendTestAlert(activeUser);
    return {
      success: result.decision.canSend,
      decision: result.decision,
      alert: result.alert,
    };
  }

  @Post('custom')
  @HttpCode(HttpStatus.OK)
  @Throttle({ alerts: { limit: 20, ttl: 60 } })
  async sendCustom(@Body() payload: SendCustomAlertDto, @ActiveUser() activeUser: ActiveUserData) {
    const result = await this.alertsService.sendCustomAlert(activeUser, payload.message);
    return {
      success: result.decision.canSend,
      decision: result.decision,
      alert: result.alert,
    };
  }
}
