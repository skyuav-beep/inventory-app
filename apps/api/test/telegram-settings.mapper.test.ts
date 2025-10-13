import assert from 'node:assert/strict';
import { mapTelegramSettings } from '../src/settings/utils/telegram-settings.mapper';

export function runTelegramSettingsMapperTests() {
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

  assert.equal(mapped.enabled, true);
  assert.equal(mapped.botToken, 'token-123');
  assert.equal(mapped.cooldownMinutes, 30);
  assert.equal(mapped.quietHours, '21-08');
  assert.equal(mapped.targets.length, 1);
  assert.equal(mapped.targets[0].chatId, '123');
  assert.equal(mapped.targets[0].label, undefined);
  assert.equal(mapped.updatedAt.toISOString(), now.toISOString());
}
