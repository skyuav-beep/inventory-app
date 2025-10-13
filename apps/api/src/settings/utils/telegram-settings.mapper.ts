import { NotificationSetting, TelegramTarget } from '@prisma/client';
import { TelegramSettingsEntity, TelegramTargetEntity } from '../entities/telegram-settings.entity';

type SettingWithTargets = NotificationSetting & { telegramTargets: TelegramTarget[] };

export function mapTelegramSettings(setting: SettingWithTargets): TelegramSettingsEntity {
  return {
    enabled: setting.telegramEnabled,
    botToken: setting.telegramBotToken ?? undefined,
    cooldownMinutes: setting.telegramCooldownMin,
    quietHours: setting.telegramQuietHours,
    targets: setting.telegramTargets.map<TelegramTargetEntity>((target) => ({
      id: target.id,
      chatId: target.chatId,
      label: target.label ?? undefined,
      enabled: target.enabled,
    })),
    updatedAt: setting.updatedAt,
  };
}
