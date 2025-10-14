import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertPolicyService } from './alert-policy.service';
import { TelegramService } from './telegram/telegram.service';

@Module({
  imports: [PrismaModule, SettingsModule],
  controllers: [AlertsController],
  providers: [AlertsService, AlertPolicyService, TelegramService],
  exports: [AlertsService],
})
export class AlertsModule {}
