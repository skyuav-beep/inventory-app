import { BadRequestException } from '@nestjs/common';
import { AlertLevel, Channel, Role, TelegramTarget } from '@prisma/client';
import { AlertsService } from '../src/alerts/alerts.service';
import { AlertPolicyDecision, AlertPolicyService } from '../src/alerts/alert-policy.service';
import { ALERT_RETRY_MAX_ATTEMPTS } from '../src/alerts/constants';
import { TelegramService } from '../src/alerts/telegram/telegram.service';
import { ActiveUserData } from '../src/auth/types/active-user-data';
import { PrismaService } from '../src/prisma/prisma.service';
import { NotificationSettingWithTargets, SettingsService } from '../src/settings/settings.service';

interface ServiceMocks {
  service: AlertsService;
  prisma: {
    alert: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  policy: { decideSend: jest.Mock };
  settings: { getRawSettings: jest.Mock };
  telegram: { sendMessage: jest.Mock };
}

const fixedCreatedAt = new Date('2024-01-01T00:00:00.000Z');

const activeAdmin: ActiveUserData = {
  userId: 'user-1',
  email: 'ops@example.com',
  name: 'Ops Manager',
  role: Role.admin,
  permissions: [],
};

function createTarget(overrides: Partial<TelegramTarget> = {}): TelegramTarget {
  return {
    id: overrides.id ?? 'target-1',
    chatId: overrides.chatId ?? 'chat-1',
    label: overrides.label ?? 'Ops',
    enabled: overrides.enabled ?? true,
    settingId: overrides.settingId ?? 'default-notification-setting',
    createdAt: overrides.createdAt ?? fixedCreatedAt,
  };
}

function createSettings(
  overrides: Partial<NotificationSettingWithTargets> = {},
): NotificationSettingWithTargets {
  return {
    id: overrides.id ?? 'default-notification-setting',
    telegramEnabled: overrides.telegramEnabled ?? false,
    telegramCooldownMin: overrides.telegramCooldownMin ?? 15,
    telegramQuietHours: overrides.telegramQuietHours ?? '22-07',
    telegramBotToken: overrides.telegramBotToken ?? 'bot-token',
    createdById: overrides.createdById ?? null,
    createdAt: overrides.createdAt ?? fixedCreatedAt,
    updatedAt: overrides.updatedAt ?? fixedCreatedAt,
    telegramTargets: overrides.telegramTargets ?? [createTarget()],
  };
}

function createAlertsService(
  overrides: {
    decision?: AlertPolicyDecision;
    settings?: NotificationSettingWithTargets;
    telegramSend?: jest.Mock;
  } = {},
): ServiceMocks {
  const decision: AlertPolicyDecision = overrides.decision ?? {
    canSend: true,
    reason: 'ok',
  };

  const settings = overrides.settings ?? createSettings();

  const alertCreate = jest.fn().mockImplementation(async ({ data }) => ({
    id: 'alert-id',
    productId: data.productId ?? null,
    level: data.level,
    channel: data.channel,
    message: data.message,
    dedupKey: data.dedupKey ?? null,
    sentAt: data.sentAt ?? null,
    retryAt: data.retryAt ?? null,
    retryReason: data.retryReason ?? null,
    retryCount: data.retryCount ?? 0,
    createdAt: fixedCreatedAt,
    product: null,
  }));

  const prisma = {
    alert: { create: alertCreate },
    $transaction: jest.fn(),
  };

  const policy = {
    decideSend: jest.fn().mockResolvedValue(decision),
  };

  const settingsService = {
    getRawSettings: jest.fn().mockResolvedValue(settings),
  };

  const telegram = {
    sendMessage: overrides.telegramSend ?? jest.fn().mockResolvedValue(undefined),
  };

  const service = new AlertsService(
    prisma as unknown as PrismaService,
    policy as unknown as AlertPolicyService,
    settingsService as unknown as SettingsService,
    telegram as unknown as TelegramService,
  );

  return {
    service,
    prisma,
    policy,
    settings: settingsService,
    telegram,
  };
}

describe('AlertsService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('정책 허용 시 알림을 생성하고 활성 대상에게 발송한다', async () => {
    const settings = createSettings({
      telegramTargets: [
        createTarget({ id: 'enabled', chatId: 'chat-enabled', enabled: true }),
        createTarget({ id: 'disabled', chatId: 'chat-disabled', enabled: false }),
      ],
      telegramEnabled: true,
    });
    const {
      service,
      prisma,
      policy,
      settings: settingsSvc,
      telegram,
    } = createAlertsService({ settings });

    const result = await service.sendTestAlert(activeAdmin);

    expect(policy.decideSend).toHaveBeenCalledWith(
      expect.objectContaining({ channel: Channel.telegram, level: AlertLevel.info }),
    );

    expect(settingsSvc.getRawSettings).toHaveBeenCalledTimes(1);
    expect(prisma.alert.create).toHaveBeenCalledTimes(1);

    const createArgs = (prisma.alert.create as jest.Mock).mock.calls[0][0];
    expect(createArgs.data.channel).toBe(Channel.telegram);
    expect(createArgs.data.message).toBe('안녕하세요 르메뜨리입니다');
    expect(createArgs.data.sentAt).toBeInstanceOf(Date);

    expect(result.decision.canSend).toBe(true);
    expect(result.alert).toBeDefined();
    expect(result.alert?.channel).toBe(Channel.telegram);
    expect(result.alert?.level).toBe(AlertLevel.info);

    expect(telegram.sendMessage).toHaveBeenCalledTimes(1);
    expect(telegram.sendMessage).toHaveBeenCalledWith({
      botToken: 'bot-token',
      chatId: 'chat-enabled',
      text: '안녕하세요 르메뜨리입니다',
    });
  });

  it('정책이 전송을 차단하면 지연 알림 레코드만 생성한다', async () => {
    const decision: AlertPolicyDecision = {
      canSend: false,
      reason: 'cooldown',
      nextAttemptAt: new Date('2024-01-01T01:00:00.000Z'),
    };

    const {
      service,
      prisma,
      policy,
      settings: settingsSvc,
      telegram,
    } = createAlertsService({ decision });

    const result = await service.notifyLowStock({
      id: 'product-1',
      name: 'Widget',
      code: 'W-1',
      remain: 2,
      safetyStock: 5,
    });

    expect(result.alert).toBeUndefined();
    expect(policy.decideSend).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'product-1',
        channel: Channel.telegram,
        level: AlertLevel.low,
      }),
    );
    expect(settingsSvc.getRawSettings).not.toHaveBeenCalled();
    expect(telegram.sendMessage).not.toHaveBeenCalled();

    expect(prisma.alert.create).toHaveBeenCalledTimes(1);
    const createArgs = (prisma.alert.create as jest.Mock).mock.calls[0][0];
    expect(createArgs.data.productId).toBe('product-1');
    expect(createArgs.data.sentAt).toBeNull();
    expect(createArgs.data.message).toContain('Widget');
    expect(createArgs.data.retryReason).toBe('cooldown');
    expect(createArgs.data.retryAt).toEqual(decision.nextAttemptAt);
    expect(createArgs.data.dedupKey).toMatch(/^deferred-/);
  });

  it('텔레그램 설정이 유효하지 않으면 알림을 재시도 상태로 저장한다', async () => {
    const settings = createSettings({
      telegramEnabled: true,
      telegramTargets: [
        createTarget({ id: 'target-disabled', chatId: 'chat-disabled', enabled: false }),
      ],
    });

    const { service, prisma, settings: settingsSvc, telegram } = createAlertsService({ settings });

    const result = await service.notifyLowStock({
      id: 'product-2',
      name: 'Gadget',
      code: 'G-2',
      remain: 1,
      safetyStock: 10,
    });

    expect(settingsSvc.getRawSettings).toHaveBeenCalledTimes(1);
    expect(telegram.sendMessage).not.toHaveBeenCalled();
    expect(prisma.alert.create).toHaveBeenCalledTimes(1);

    const createArgs = (prisma.alert.create as jest.Mock).mock.calls[0][0];
    expect(createArgs.data.productId).toBe('product-2');
    expect(createArgs.data.sentAt).toBeNull();
    expect(createArgs.data.retryReason).toBe('delivery_error');
    expect(createArgs.data.retryAt).toBeInstanceOf(Date);

    expect(result.alert?.retryReason).toBe('delivery_error');
    expect(result.alert?.retryAt).toBeDefined();
    expect(result.alert?.sentAt).toBeUndefined();
  });

  it('사용자 정의 알림 본문이 비어 있으면 예외를 던진다', async () => {
    const { service, prisma, settings: settingsSvc, telegram } = createAlertsService();

    await expect(service.sendCustomAlert(activeAdmin, '   ')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(prisma.alert.create).not.toHaveBeenCalled();
    expect(settingsSvc.getRawSettings).not.toHaveBeenCalled();
    expect(telegram.sendMessage).not.toHaveBeenCalled();
  });

  it('봇 토큰이 비어있으면 사용자 정의 발송을 거부한다', async () => {
    const settings = createSettings({
      telegramEnabled: true,
      telegramBotToken: '   ',
      telegramTargets: [createTarget({ chatId: 'chat-enabled', enabled: true })],
    });

    const { service, prisma, settings: settingsSvc, telegram } = createAlertsService({ settings });

    await expect(service.sendCustomAlert(activeAdmin, '점검 알림')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(settingsSvc.getRawSettings).toHaveBeenCalledTimes(1);
    expect(prisma.alert.create).not.toHaveBeenCalled();
    expect(telegram.sendMessage).not.toHaveBeenCalled();
  });

  it('텔레그램이 비활성화돼 있으면 테스트 발송을 거부한다', async () => {
    const settings = createSettings({
      telegramEnabled: false,
      telegramBotToken: 'bot-token',
      telegramTargets: [createTarget({ chatId: 'chat-enabled', enabled: true })],
    });

    const { service, prisma, settings: settingsSvc, telegram } = createAlertsService({ settings });

    await expect(service.sendTestAlert(activeAdmin)).rejects.toBeInstanceOf(BadRequestException);

    expect(settingsSvc.getRawSettings).toHaveBeenCalledTimes(1);
    expect(prisma.alert.create).not.toHaveBeenCalled();
    expect(telegram.sendMessage).not.toHaveBeenCalled();
  });

  it('활성화된 텔레그램 대상이 없으면 테스트 발송을 거부한다', async () => {
    const settings = createSettings({
      telegramEnabled: true,
      telegramTargets: [createTarget({ chatId: 'chat-disabled', enabled: false })],
    });

    const { service, prisma, settings: settingsSvc, telegram } = createAlertsService({ settings });

    await expect(service.sendTestAlert(activeAdmin)).rejects.toBeInstanceOf(BadRequestException);

    expect(settingsSvc.getRawSettings).toHaveBeenCalledTimes(1);
    expect(prisma.alert.create).not.toHaveBeenCalled();
    expect(telegram.sendMessage).not.toHaveBeenCalled();
  });

  it('텔레그램 API 오류가 발생하면 사용자 정의 발송을 실패로 처리한다', async () => {
    const settings = createSettings({ telegramEnabled: true });
    const telegramSend = jest.fn().mockRejectedValue(new Error('Unauthorized'));

    const {
      service,
      prisma,
      settings: settingsSvc,
      telegram,
    } = createAlertsService({
      settings,
      telegramSend,
    });

    await expect(service.sendCustomAlert(activeAdmin, '공지')).rejects.toThrow(
      '텔레그램 메시지 전송에 실패했습니다: Unauthorized',
    );

    expect(settingsSvc.getRawSettings).toHaveBeenCalledTimes(1);
    expect(telegram.sendMessage).toHaveBeenCalledTimes(1);
    expect(prisma.alert.create).not.toHaveBeenCalled();
  });

  describe('processPendingAlert', () => {
    const baseAlert = {
      id: 'alert-1',
      productId: 'product-1',
      level: AlertLevel.low as AlertLevel,
      channel: Channel.telegram as Channel,
      message: '재고 부족 알림',
      dedupKey: null,
      sentAt: null,
      retryAt: new Date('2024-01-01T01:00:00.000Z'),
      retryReason: 'cooldown',
      retryCount: 0,
      createdAt: fixedCreatedAt,
      product: null,
    };

    it('정책이 계속 차단하면 재시도 정보를 갱신한다', async () => {
      const prisma = {
        alert: {
          create: jest.fn(),
          findUnique: jest.fn().mockResolvedValue(baseAlert),
          update: jest.fn().mockResolvedValue({ ...baseAlert, retryCount: 1 }),
        },
        $transaction: jest.fn(),
      };

      const decision: AlertPolicyDecision = {
        canSend: false,
        reason: 'quiet_hours',
        nextAttemptAt: new Date('2024-01-01T02:00:00.000Z'),
      };

      const policy = { decideSend: jest.fn().mockResolvedValue(decision) };
      const settingsService = { getRawSettings: jest.fn() };
      const telegram = { sendMessage: jest.fn() };

      const service = new AlertsService(
        prisma as unknown as PrismaService,
        policy as unknown as AlertPolicyService,
        settingsService as unknown as SettingsService,
        telegram as unknown as TelegramService,
      );

      const result = await service.processPendingAlert(baseAlert.id);

      expect(result).toBe('rescheduled');
      expect(prisma.alert.findUnique).toHaveBeenCalledTimes(1);
      expect(policy.decideSend).toHaveBeenCalledWith(
        expect.objectContaining({ productId: baseAlert.productId, channel: baseAlert.channel }),
      );
      expect(settingsService.getRawSettings).not.toHaveBeenCalled();
      expect(prisma.alert.update).toHaveBeenCalledWith({
        where: { id: baseAlert.id },
        data: {
          retryAt: decision.nextAttemptAt,
          retryReason: 'quiet_hours',
          retryCount: { increment: 1 },
        },
      });
    });

    it('전송 가능하면 텔레그램 발송 후 완료로 마킹한다', async () => {
      const prisma = {
        alert: {
          create: jest.fn(),
          findUnique: jest.fn().mockResolvedValue(baseAlert),
          update: jest
            .fn()
            .mockResolvedValue({ ...baseAlert, sentAt: new Date(), retryCount: 1, retryAt: null }),
        },
        $transaction: jest.fn(),
      };

      const policy = { decideSend: jest.fn().mockResolvedValue({ canSend: true, reason: 'ok' }) };
      const settings = createSettings({ telegramEnabled: true });
      const settingsService = { getRawSettings: jest.fn().mockResolvedValue(settings) };
      const telegram = { sendMessage: jest.fn().mockResolvedValue(undefined) };

      const service = new AlertsService(
        prisma as unknown as PrismaService,
        policy as unknown as AlertPolicyService,
        settingsService as unknown as SettingsService,
        telegram as unknown as TelegramService,
      );

      const result = await service.processPendingAlert(baseAlert.id);

      expect(result).toBe('sent');
      expect(settingsService.getRawSettings).toHaveBeenCalledTimes(1);
      expect(telegram.sendMessage).toHaveBeenCalledTimes(
        settings.telegramTargets.filter((t) => t.enabled).length,
      );
      expect(prisma.alert.update).toHaveBeenCalledWith({
        where: { id: baseAlert.id },
        data: {
          sentAt: expect.any(Date),
          retryAt: null,
          retryReason: null,
          retryCount: { increment: 1 },
        },
      });
    });

    it('설정 문제로 전송하지 못하면 재시도를 예약한다', async () => {
      const updateMock = jest.fn().mockResolvedValue({ retryCount: 1 });
      const prisma = {
        alert: {
          create: jest.fn(),
          findUnique: jest.fn().mockResolvedValue(baseAlert),
          update: updateMock,
        },
        $transaction: jest.fn(),
      };

      const policy = { decideSend: jest.fn().mockResolvedValue({ canSend: true, reason: 'ok' }) };
      const settings = createSettings({
        telegramEnabled: true,
        telegramTargets: [createTarget({ id: 'target-disabled', enabled: false })],
      });
      const settingsService = { getRawSettings: jest.fn().mockResolvedValue(settings) };
      const telegram = { sendMessage: jest.fn() };

      const service = new AlertsService(
        prisma as unknown as PrismaService,
        policy as unknown as AlertPolicyService,
        settingsService as unknown as SettingsService,
        telegram as unknown as TelegramService,
      );

      const result = await service.processPendingAlert(baseAlert.id);

      expect(result).toBe('rescheduled');
      expect(settingsService.getRawSettings).toHaveBeenCalledTimes(1);
      expect(telegram.sendMessage).not.toHaveBeenCalled();
      expect(updateMock).toHaveBeenCalledWith({
        where: { id: baseAlert.id },
        data: {
          retryAt: expect.any(Date),
          retryReason: 'error',
          retryCount: { increment: 1 },
        },
        select: { retryCount: true },
      });
    });

    it('최대 재시도 횟수를 넘기면 중단 표시 후 종료한다', async () => {
      const exhaustedAlert = { ...baseAlert, retryCount: ALERT_RETRY_MAX_ATTEMPTS };

      const prisma = {
        alert: {
          create: jest.fn(),
          findUnique: jest.fn().mockResolvedValue(exhaustedAlert),
          update: jest.fn().mockResolvedValue(exhaustedAlert),
        },
        $transaction: jest.fn(),
      };

      const policy = { decideSend: jest.fn() };
      const settingsService = { getRawSettings: jest.fn() };
      const telegram = { sendMessage: jest.fn() };

      const service = new AlertsService(
        prisma as unknown as PrismaService,
        policy as unknown as AlertPolicyService,
        settingsService as unknown as SettingsService,
        telegram as unknown as TelegramService,
      );

      const result = await service.processPendingAlert(exhaustedAlert.id);

      expect(result).toBe('aborted');
      expect(policy.decideSend).not.toHaveBeenCalled();
      expect(prisma.alert.update).toHaveBeenCalledWith({
        where: { id: exhaustedAlert.id },
        data: {
          retryAt: null,
          retryReason: 'aborted',
        },
      });
    });
  });
});
