import { Injectable } from '@nestjs/common';
import { AlertLevel, Channel } from '@prisma/client';
import { SettingsService } from '../settings/settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { getNextQuietHoursExit, isWithinQuietHours, parseQuietHoursWindow } from './utils/quiet-hours.util';

export type AlertPolicyReason = 'cooldown' | 'quiet_hours' | 'ok';

export interface AlertPolicyDecision {
  reason: AlertPolicyReason;
  canSend: boolean;
  nextAttemptAt?: Date;
}

@Injectable()
export class AlertPolicyService {
  constructor(private readonly prisma: PrismaService, private readonly settingsService: SettingsService) {}

  async decideSend(params: {
    productId?: string;
    channel: Channel;
    level: AlertLevel;
    now?: Date;
  }): Promise<AlertPolicyDecision> {
    const now = params.now ?? new Date();
    const settings = await this.settingsService.getRawSettings();

    if (this.isWithinQuietHours(now, settings.telegramQuietHours)) {
      const window = parseQuietHoursWindow(settings.telegramQuietHours);
      return {
        canSend: false,
        reason: 'quiet_hours',
        nextAttemptAt: getNextQuietHoursExit(now, window),
      };
    }

    if (params.productId) {
      const lastAlert = await this.prisma.alert.findFirst({
        where: {
          productId: params.productId,
          channel: params.channel,
          sentAt: {
            not: null,
          },
        },
        orderBy: { sentAt: 'desc' },
      });

      if (lastAlert && lastAlert.sentAt) {
        const minNextSend = new Date(lastAlert.sentAt.getTime() + settings.telegramCooldownMin * 60000);
        if (minNextSend > now) {
          return {
            canSend: false,
            reason: 'cooldown',
            nextAttemptAt: minNextSend,
          };
        }
      }
    }

    return {
      canSend: true,
      reason: 'ok',
    };
  }

  private isWithinQuietHours(date: Date, quietHours: string): boolean {
    if (!quietHours || quietHours.trim() === '') {
      return false;
    }

    try {
      const window = parseQuietHoursWindow(quietHours);
      return isWithinQuietHours(date, window);
    } catch {
      return false;
    }
  }
}
