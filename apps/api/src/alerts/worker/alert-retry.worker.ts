import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AlertsService } from '../alerts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ALERT_RETRY_DEFAULT_INTERVAL_MS, ALERT_RETRY_MAX_ATTEMPTS } from '../constants';

@Injectable()
export class AlertRetryWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlertRetryWorker.name);
  private readonly tickIntervalMs = 30_000;
  private timer: NodeJS.Timeout | null = null;
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertsService: AlertsService,
  ) {}

  onModuleInit(): void {
    this.start();
  }

  onModuleDestroy(): void {
    this.stop();
  }

  private start(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.execute();
    }, this.tickIntervalMs);

    void this.execute();
  }

  private stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async execute(): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;

    try {
      const now = new Date();

      const pendingAlerts = await this.prisma.alert.findMany({
        where: {
          sentAt: null,
          retryAt: {
            not: null,
            lte: now,
          },
        },
        orderBy: { retryAt: 'asc' },
        take: 10,
      });

      for (const alert of pendingAlerts) {
        try {
          const result = await this.alertsService.processPendingAlert(alert.id);
          if (result === 'sent') {
            this.logger.log(`알림(ID: ${alert.id}) 재시도 후 발송 완료`);
          } else if (result === 'aborted') {
            this.logger.warn(`알림(ID: ${alert.id}) 재시도 한도를 초과하여 중단`);
          }
        } catch (error) {
          const reason = error instanceof Error ? error.message : '알 수 없는 오류';
          this.logger.error(`알림(ID: ${alert.id}) 재시도 처리 중 오류: ${reason}`);

          const rescheduleUntil = new Date(Date.now() + ALERT_RETRY_DEFAULT_INTERVAL_MS);
          const updated = await this.prisma.alert.update({
            where: { id: alert.id },
            data: {
              retryAt: rescheduleUntil,
              retryReason: 'error',
              retryCount: { increment: 1 },
            },
            select: { retryCount: true },
          });

          this.logger.warn(
            `알림(ID: ${alert.id}) 오류로 재시도 예약 (다음 시도: ${rescheduleUntil.toISOString()})`,
          );

          if (updated.retryCount >= ALERT_RETRY_MAX_ATTEMPTS) {
            await this.prisma.alert.update({
              where: { id: alert.id },
              data: {
                retryAt: null,
                retryReason: 'aborted',
              },
            });
            this.logger.error(`알림(ID: ${alert.id}) 오류가 지속되어 재시도를 중단합니다.`);
          }
        }
      }
    } finally {
      this.processing = false;
    }
  }
}
