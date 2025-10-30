import { EventEmitter } from 'node:events';
import { TelegramService } from '../src/alerts/telegram/telegram.service';

const https: typeof import('node:https') = require('node:https');

describe('TelegramService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should call Telegram API with expected payload', async () => {
    const service = new TelegramService();
    const writeMock = jest.fn();
    const endMock = jest.fn();

    const requestSpy = jest
      .spyOn(https, 'request')
      .mockImplementation((options: any, callback: any) => {
        const response = new EventEmitter() as any;
        response.statusCode = 200;

        const requestEmitter = new EventEmitter() as any;
        requestEmitter.write = writeMock.mockImplementation(() => undefined);
        requestEmitter.end = endMock.mockImplementation(() => {
          callback(response);
          response.emit('data', Buffer.from('ok'));
          response.emit('end');
        });
        requestEmitter.destroy = jest.fn();
        requestEmitter.on = function (event: string, handler: (...args: any[]) => void) {
          EventEmitter.prototype.on.call(this, event, handler);
          return this;
        };

        return requestEmitter;
      });

    await service.sendMessage({ botToken: 'test-token', chatId: '123', text: 'hello' });

    expect(requestSpy).toHaveBeenCalled();
    const [options] = requestSpy.mock.calls[0];
    expect(options).toEqual(
      expect.objectContaining({
        hostname: 'api.telegram.org',
        method: 'POST',
        path: '/bottest-token/sendMessage',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        family: 4,
      }),
    );
    expect(writeMock).toHaveBeenCalledWith(
      JSON.stringify({
        chat_id: '123',
        text: 'hello',
        disable_notification: false,
        disable_web_page_preview: true,
      }),
    );
    expect(endMock).toHaveBeenCalled();
  });
});
