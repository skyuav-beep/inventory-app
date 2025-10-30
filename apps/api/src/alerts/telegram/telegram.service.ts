import { Injectable, Logger } from '@nestjs/common';
import { request as httpsRequest } from 'node:https';
import { URL } from 'node:url';

export interface TelegramSendParams {
  botToken: string;
  chatId: string;
  text: string;
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  async sendMessage({ botToken, chatId, text }: TelegramSendParams): Promise<void> {
    const url = new URL(`https://api.telegram.org/bot${botToken}/sendMessage`);
    const timeoutMs = 10000; // 10s timeout per attempt
    const maxAttempts = 3;
    const payload = JSON.stringify({
      chat_id: chatId,
      text,
      disable_notification: false,
      disable_web_page_preview: true,
    });

    const attemptSend = async (attempt: number): Promise<void> => {
      try {
        await this.postJson(url, payload, timeoutMs);
      } catch (error) {
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        const raw = (normalizedError.message ?? '').toLowerCase();
        const isTimeout =
          raw.includes('timeout') ||
          raw.includes('etimedout') ||
          raw.includes('request timed out') ||
          raw.includes('socket hang up');
        const isNetwork =
          raw.includes('enetunreach') ||
          raw.includes('ehostunreach') ||
          raw.includes('econnrefused') ||
          raw.includes('econnreset') ||
          raw.includes('eai_again') ||
          raw.includes('enotfound');

        if (attempt < maxAttempts && (isTimeout || isNetwork)) {
          const backoffMs = 500 * Math.pow(2, attempt - 1);
          this.logger.warn(
            `Telegram request attempt ${attempt} failed (${normalizedError.message}). Retrying in ${backoffMs}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          return attemptSend(attempt + 1);
        }

        this.logger.error('Failed to send Telegram message', normalizedError.stack);
        throw normalizedError;
      }
    };

    await attemptSend(1);
  }

  private async postJson(url: URL, body: string, timeoutMs: number): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const request = httpsRequest(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port || undefined,
          path: `${url.pathname}${url.search}`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
          timeout: timeoutMs,
          family: 4,
        },
        (response) => {
          const chunks: Array<Buffer> = [];
          response.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
          });
          response.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            const status = response.statusCode ?? 0;
            if (status >= 200 && status < 300) {
              resolve();
            } else {
              reject(new Error(`Telegram API responded with ${status}: ${text}`));
            }
          });
        },
      );

      request.on('timeout', () => {
        request.destroy(new Error(`Request timed out after ${timeoutMs}ms`));
      });

      request.on('error', reject);
      request.write(body);
      request.end();
    });
  }
}
