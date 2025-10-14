import { TelegramService } from '../src/alerts/telegram/telegram.service';

describe('TelegramService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should call Telegram API with expected payload', async () => {
    const service = new TelegramService();
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'ok',
    } as unknown as Response);

    await service.sendMessage({ botToken: 'test-token', chatId: '123', text: 'hello' });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('https://api.telegram.org/bottest-token/sendMessage'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          chat_id: '123',
          text: 'hello',
          disable_notification: false,
          disable_web_page_preview: true,
        }),
      }),
    );
  });
});
