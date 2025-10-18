import { Injectable } from '@nestjs/common';
import { NotificationSetting, TelegramTarget } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateTelegramSettingsDto } from './dto/update-telegram-settings.dto';
import { TelegramSettingsEntity } from './entities/telegram-settings.entity';
import { mapTelegramSettings } from './utils/telegram-settings.mapper';

export type NotificationSettingWithTargets = NotificationSetting & {
  telegramTargets: TelegramTarget[];
};

@Injectable()
export class SettingsService {
  private readonly defaultSettingId = 'default-notification-setting';

  constructor(private readonly prisma: PrismaService) {}

  async getRawSettings(): Promise<NotificationSettingWithTargets> {
    return this.ensureSetting();
  }

  async getTelegramSettings(): Promise<TelegramSettingsEntity> {
    const setting = await this.ensureSetting();
    return mapTelegramSettings(setting);
  }

  async updateTelegramSettings(
    payload: UpdateTelegramSettingsDto,
    options: { updatedByUserId?: string },
  ): Promise<TelegramSettingsEntity> {
    const setting = await this.prisma.$transaction(async (tx) => {
      const sanitizedBotToken = payload.botToken?.trim() ?? '';
      const botTokenValue = sanitizedBotToken.length > 0 ? sanitizedBotToken : null;

      const upserted = await tx.notificationSetting.upsert({
        where: { id: this.defaultSettingId },
        update: {
          telegramEnabled: payload.enabled,
          telegramCooldownMin: payload.cooldownMinutes,
          telegramQuietHours: payload.quietHours,
          telegramBotToken: botTokenValue,
        },
        create: {
          id: this.defaultSettingId,
          telegramEnabled: payload.enabled,
          telegramCooldownMin: payload.cooldownMinutes,
          telegramQuietHours: payload.quietHours,
          telegramBotToken: botTokenValue,
          createdById: options.updatedByUserId,
        },
      });

      if (payload.targets) {
        await tx.telegramTarget.deleteMany({ where: { settingId: upserted.id } });

        if (payload.targets.length > 0) {
          await tx.telegramTarget.createMany({
            data: payload.targets.map((target) => ({
              chatId: target.chatId,
              label: target.label,
              enabled: target.enabled ?? true,
              settingId: upserted.id,
            })),
          });
        }
      }

      return tx.notificationSetting.findUniqueOrThrow({
        where: { id: upserted.id },
        include: { telegramTargets: true },
      });
    });

    return mapTelegramSettings(setting);
  }

  private async ensureSetting(): Promise<NotificationSettingWithTargets> {
    const existing = await this.prisma.notificationSetting.findUnique({
      where: { id: this.defaultSettingId },
      include: { telegramTargets: true },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.notificationSetting.create({
      data: {
        id: this.defaultSettingId,
      },
      include: { telegramTargets: true },
    });
  }
}
