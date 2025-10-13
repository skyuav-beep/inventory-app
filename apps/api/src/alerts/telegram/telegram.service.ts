import { Injectable, Logger } from '@nestjs/common';

export interface TelegramSendParams {
  botToken: string;
  chatId: string;
  text: string;
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  async sendMessage({ botToken, chatId, text }: TelegramSendParams): Promise<void> {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_notification: false,
          disable_web_page_preview: true,
        }),
      });

      if (!response.ok) {
        const bodyText = await response.text();
        this.logger.warn(`Telegram API responded with ${response.status}: ${bodyText}`);
      }
    } catch (error) {
      this.logger.error('Failed to send Telegram message', error instanceof Error ? error.stack : undefined);
    }
  }
}
