import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AlertLevel, Channel, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActiveUserData } from '../auth/types/active-user-data';
import { AlertListQueryDto } from './dto/alert-query.dto';
import { AlertEntity, toAlertEntity } from './entities/alert.entity';
import { buildTestAlertMessage } from './utils/test-alert.util';
import { buildLowStockAlertMessage } from './utils/low-stock.util';
import { AlertPolicyDecision, AlertPolicyService } from './alert-policy.service';
import { SettingsService } from '../settings/settings.service';
import { TelegramService } from './telegram/telegram.service';
import { ProductEntity } from '../products/entities/product.entity';
import { ALERT_RETRY_DEFAULT_INTERVAL_MS, ALERT_RETRY_MAX_ATTEMPTS } from './constants';

export interface AlertSendResult {
  decision: AlertPolicyDecision;
  alert?: AlertEntity;
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: AlertPolicyService,
    private readonly settingsService: SettingsService,
    private readonly telegramService: TelegramService,
  ) {}

  async findAll(query: AlertListQueryDto): Promise<{ data: AlertEntity[]; total: number }> {
    const page = query.page ?? 1;
    const size = query.size ?? 20;
    const skip = (page - 1) * size;

    const where: Prisma.AlertWhereInput = {};

    if (query.productId) {
      where.productId = query.productId;
    }

    if (query.level) {
      where.level = query.level;
    }

    if (query.channel) {
      where.channel = query.channel;
    }

    const [alerts, total] = await this.prisma.$transaction([
      this.prisma.alert.findMany({
        where,
        skip,
        take: size,
        orderBy: { createdAt: 'desc' },
        include: { product: true },
      }),
      this.prisma.alert.count({ where }),
    ]);

    return {
      data: alerts.map(toAlertEntity),
      total,
    };
  }

  async sendTestAlert(activeUser: ActiveUserData): Promise<AlertSendResult> {
    const decision = await this.policy.decideSend({
      channel: Channel.telegram,
      level: AlertLevel.info,
    });

    if (!decision.canSend) {
      await this.registerDeferredAlert(decision, {
        message: buildTestAlertMessage(activeUser.name),
        channel: Channel.telegram,
        level: AlertLevel.info,
      });

      return {
        decision,
      };
    }

    const message = buildTestAlertMessage(activeUser.name);

    const settings = await this.settingsService.getRawSettings();

    const alert = await this.createAlertRecord({
      level: AlertLevel.info,
      channel: Channel.telegram,
      message,
    });

    await this.deliverViaTelegram(
      settings.telegramBotToken,
      settings.telegramEnabled,
      settings.telegramTargets,
      message,
    );

    return {
      decision,
      alert,
    };
  }

  async notifyLowStock(
    product: Pick<ProductEntity, 'id' | 'name' | 'code' | 'remain' | 'safetyStock'>,
  ): Promise<AlertSendResult> {
    const message = buildLowStockAlertMessage(product);

    const decision = await this.policy.decideSend({
      productId: product.id,
      channel: Channel.telegram,
      level: AlertLevel.low,
    });

    if (!decision.canSend) {
      await this.registerDeferredAlert(decision, {
        productId: product.id,
        message,
        channel: Channel.telegram,
        level: AlertLevel.low,
      });

      return {
        decision,
      };
    }

    const settings = await this.settingsService.getRawSettings();

    const alert = await this.createAlertRecord({
      productId: product.id,
      level: AlertLevel.low,
      channel: Channel.telegram,
      message,
    });

    await this.deliverViaTelegram(
      settings.telegramBotToken,
      settings.telegramEnabled,
      settings.telegramTargets,
      message,
    );

    return {
      decision,
      alert,
    };
  }

  async sendCustomAlert(activeUser: ActiveUserData, message: string): Promise<AlertSendResult> {
    const trimmed = message.trim();

    if (!trimmed) {
      throw new BadRequestException('메시지를 입력해주세요.');
    }

    const decision = await this.policy.decideSend({
      channel: Channel.telegram,
      level: AlertLevel.info,
    });

    const finalMessage = `[관리자 ${activeUser.name}] ${trimmed}`;

    if (!decision.canSend) {
      await this.registerDeferredAlert(decision, {
        message: finalMessage,
        channel: Channel.telegram,
        level: AlertLevel.info,
      });

      return {
        decision,
      };
    }

    const settings = await this.settingsService.getRawSettings();

    const alert = await this.createAlertRecord({
      level: AlertLevel.info,
      channel: Channel.telegram,
      message: finalMessage,
    });

    await this.deliverViaTelegram(
      settings.telegramBotToken,
      settings.telegramEnabled,
      settings.telegramTargets,
      finalMessage,
    );

    return {
      decision,
      alert,
    };
  }

  private async createAlertRecord(payload: {
    productId?: string;
    level: AlertLevel;
    channel: Channel;
    message: string;
  }): Promise<AlertEntity> {
    const alert = await this.prisma.alert.create({
      data: {
        productId: payload.productId,
        level: payload.level,
        channel: payload.channel,
        message: payload.message,
        dedupKey: payload.productId ? `${payload.productId}-${Date.now()}` : undefined,
        sentAt: new Date(),
      },
      include: { product: true },
    });

    return toAlertEntity(alert);
  }

  private async registerDeferredAlert(
    decision: AlertPolicyDecision,
    payload: { message: string; channel: Channel; level: AlertLevel; productId?: string },
  ): Promise<void> {
    const retryAt = this.resolveNextAttempt(decision);

    await this.prisma.alert.create({
      data: {
        productId: payload.productId,
        level: payload.level,
        channel: payload.channel,
        message: payload.message,
        sentAt: null,
        dedupKey: this.buildDeferredDedupKey(payload.productId),
        retryAt,
        retryReason: decision.reason,
      },
    });
  }

  async processPendingAlert(
    alertId: string,
  ): Promise<'sent' | 'rescheduled' | 'skipped' | 'aborted'> {
    const alert = await this.prisma.alert.findUnique({
      where: { id: alertId },
      include: { product: true },
    });

    if (!alert) {
      this.logger.warn(`재시도 대상 알림(ID: ${alertId})을 찾을 수 없습니다.`);
      return 'skipped';
    }

    if (alert.sentAt) {
      return 'skipped';
    }

    if (alert.retryCount >= ALERT_RETRY_MAX_ATTEMPTS) {
      await this.prisma.alert.update({
        where: { id: alertId },
        data: {
          retryAt: null,
          retryReason: 'aborted',
        },
      });
      this.logger.warn(`알림(ID: ${alertId})이 최대 재시도 횟수를 초과하여 중단되었습니다.`);
      return 'aborted';
    }

    const decision = await this.policy.decideSend({
      productId: alert.productId ?? undefined,
      channel: alert.channel,
      level: alert.level,
    });

    if (!decision.canSend) {
      const retryAt = this.resolveNextAttempt(decision);

      await this.prisma.alert.update({
        where: { id: alertId },
        data: {
          retryAt,
          retryReason: decision.reason,
          retryCount: { increment: 1 },
        },
      });

      return 'rescheduled';
    }

    const settings = await this.settingsService.getRawSettings();
    const message = alert.message;

    await this.deliverViaTelegram(
      settings.telegramBotToken,
      settings.telegramEnabled,
      settings.telegramTargets,
      message,
    );

    await this.prisma.alert.update({
      where: { id: alertId },
      data: {
        sentAt: new Date(),
        retryAt: null,
        retryReason: null,
        retryCount: { increment: 1 },
      },
    });

    return 'sent';
  }

  private async deliverViaTelegram(
    botToken: string | null,
    enabled: boolean,
    targets: Array<{ chatId: string; enabled: boolean }>,
    message: string,
  ): Promise<void> {
    if (!enabled) {
      return;
    }

    if (!botToken || botToken.trim() === '') {
      this.logger.warn('텔레그램 봇 토큰이 설정되지 않아 메시지를 전송하지 않습니다.');
      return;
    }

    const activeTargets = targets.filter((target) => target.enabled);

    if (activeTargets.length === 0) {
      this.logger.log('전송할 텔레그램 대상이 없습니다.');
      return;
    }

    await Promise.all(
      activeTargets.map((target) =>
        this.telegramService.sendMessage({
          botToken,
          chatId: target.chatId,
          text: message,
        }),
      ),
    );
  }

  private resolveNextAttempt(decision: AlertPolicyDecision): Date {
    if (decision.nextAttemptAt) {
      return decision.nextAttemptAt;
    }

    return new Date(Date.now() + ALERT_RETRY_DEFAULT_INTERVAL_MS);
  }

  private buildDeferredDedupKey(productId?: string): string {
    return `deferred-${productId ?? 'general'}-${Date.now()}`;
  }
}
