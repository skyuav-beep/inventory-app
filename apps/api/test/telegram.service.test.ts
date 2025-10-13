import assert from 'node:assert/strict';
import { TelegramService } from '../src/alerts/telegram/telegram.service';

export async function runTelegramServiceTests() {
  const service = new TelegramService();
  let called = false;

  const originalFetch = (global as any).fetch;

  (global as any).fetch = async (input: any, init?: any) => {
    called = true;
    assert.ok(typeof input === 'string');
    assert.ok(String(input).includes('https://api.telegram.org/bottest-token/sendMessage'));
    assert.equal(init?.method, 'POST');
    const body = init?.body ? JSON.parse(init.body as string) : null;
    assert.equal(body.chat_id, '123');
    assert.equal(body.text, 'hello');

    return {
      ok: true,
      status: 200,
      text: async () => 'ok',
    };
  };

  await service.sendMessage({ botToken: 'test-token', chatId: '123', text: 'hello' });
  assert.equal(called, true);

  (global as any).fetch = originalFetch;
}
