import { mapTelegramSettings } from '../src/settings/utils/telegram-settings.mapper';

describe('mapTelegramSettings', () => {
  it('should map raw settings to entity shape', () => {
    const now = new Date('2024-04-29T00:00:00.000Z');

    const mapped = mapTelegramSettings({
      id: 'default-notification-setting',
      telegramEnabled: true,
      telegramCooldownMin: 30,
      telegramQuietHours: '21-08',
      telegramBotToken: 'token-123',
      createdById: null,
      createdAt: now,
      updatedAt: now,
      telegramTargets: [
        {
          id: 'target-1',
          chatId: '123',
          label: null,
          enabled: true,
          settingId: 'default-notification-setting',
          createdAt: now,
        },
      ],
    });

    expect(mapped).toMatchObject({
      enabled: true,
      botToken: 'token-123',
      cooldownMinutes: 30,
      quietHours: '21-08',
      targets: [
        {
          chatId: '123',
          label: undefined,
          enabled: true,
        },
      ],
    });

    expect(mapped.updatedAt.toISOString()).toBe(now.toISOString());
  });
});
