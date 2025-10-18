import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { hashSync } from 'bcryptjs';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AlertsService } from '../../src/alerts/alerts.service';
import { TelegramService } from '../../src/alerts/telegram/telegram.service';
import { AuditAction, AlertLevel, Channel, ProductStatus, Resource, Role, ReturnStatus } from '@prisma/client';

jest.setTimeout(60000);

const VIEWER_EMAIL = 'viewer@example.com';
const VIEWER_PASSWORD = 'ViewerPass123!';
const OPERATOR_EMAIL = 'operator@example.com';
const OPERATOR_PASSWORD = 'OperatorPass123!';

interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: Role;
  passwordHash: string;
  disabled: boolean;
  permissions: Array<{
    id: string;
    resource: Resource;
    read: boolean;
    write: boolean;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

interface ProductRecord {
  id: string;
  code: string;
  name: string;
  description?: string;
  specification?: string;
  unit: string;
  safetyStock: number;
  totalIn: number;
  totalOut: number;
  totalReturn: number;
  remain: number;
  status: ProductStatus;
  disabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface InboundRecord {
  id: string;
  productId: string;
  quantity: number;
  dateIn: Date;
  note?: string | null;
  createdAt: Date;
}

interface OutboundRecord {
  id: string;
  productId: string;
  quantity: number;
  dateOut: Date;
  note?: string | null;
  createdAt: Date;
}

interface ReturnRecordStub {
  id: string;
  productId: string;
  quantity: number;
  dateReturn: Date;
  reason: string;
  status: ReturnStatus;
  createdAt: Date;
}

interface NotificationSettingRecord {
  id: string;
  telegramEnabled: boolean;
  telegramCooldownMin: number;
  telegramQuietHours: string;
  telegramBotToken: string | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface TelegramTargetRecord {
  id: string;
  chatId: string;
  label?: string | null;
  enabled: boolean;
  settingId: string;
  createdAt: Date;
}

interface AlertRecord {
  id: string;
  productId?: string;
  level: AlertLevel;
  channel: Channel;
  message: string;
  dedupKey?: string | null;
  sentAt?: Date | null;
  retryAt?: Date | null;
  retryReason?: string | null;
  retryCount: number;
  createdAt: Date;
}

interface AuditLogRecord {
  id: string;
  userId?: string | null;
  resource: Resource;
  action: AuditAction;
  entityId?: string | null;
  payloadJson?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
}

class InMemoryPrismaService {
  private users: UserRecord[] = [];
  private products: ProductRecord[] = [];
  private inbounds: InboundRecord[] = [];
  private outbounds: OutboundRecord[] = [];
  private returnRecords: ReturnRecordStub[] = [];
  private notificationSettingRecord: NotificationSettingRecord;
  private telegramTargets: TelegramTargetRecord[] = [];
  private alerts: AlertRecord[] = [];
  private auditLogs: AuditLogRecord[] = [];

  constructor() {
    const userId = randomUUID();
    const passwordHash = hashSync('ChangeMe123!', 10);
    const now = new Date();

    this.users.push({
      id: userId,
      email: 'admin@example.com',
      name: 'Admin',
      role: Role.admin,
      passwordHash,
      disabled: false,
      createdAt: now,
      updatedAt: now,
      permissions: Object.values(Resource).map((resource) => ({
        id: randomUUID(),
        resource,
        read: true,
        write: true,
      })),
    });

    this.notificationSettingRecord = {
      id: 'default-notification-setting',
      telegramEnabled: true,
      telegramCooldownMin: 60,
      telegramQuietHours: '22-07',
      telegramBotToken: 'test-token',
      createdById: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.telegramTargets = [
      {
        id: randomUUID(),
        chatId: '123456',
        label: '운영팀',
      enabled: true,
        settingId: this.notificationSettingRecord.id,
        createdAt: new Date(),
      },
    ];
  }

  async $connect(): Promise<void> {}

  async $disconnect(): Promise<void> {}

  async $transaction<T>(operations: Array<Promise<T>> | ((tx: this) => Promise<T>)): Promise<any> {
    if (typeof operations === 'function') {
      return operations(this);
    }

    return Promise.all(operations);
  }

  async $queryRaw<T = unknown>(): Promise<T> {
    return [{ ok: true }] as unknown as T;
  }

  get auditLog() {
    return {
      create: async ({
        data,
      }: {
        data: {
          userId?: string | null;
          resource: Resource;
          action: AuditAction;
          entityId?: string | null;
          payloadJson?: unknown;
          ipAddress?: string | null;
          userAgent?: string | null;
        };
      }) => {
        const record: AuditLogRecord = {
          id: randomUUID(),
          userId: data.userId ?? null,
          resource: data.resource,
          action: data.action,
          entityId: data.entityId ?? null,
          payloadJson: data.payloadJson,
          ipAddress: data.ipAddress ?? null,
          userAgent: data.userAgent ?? null,
          createdAt: new Date(),
        };
        this.auditLogs.push(record);
        return { ...record };
      },
    };
  }

  get user() {
    return {
      findUnique: async ({ where }: { where: { email?: string; id?: string } }) => {
        if (where.email) {
          return this.cloneUser(this.users.find((user) => user.email === where.email));
        }

        if (where.id) {
          return this.cloneUser(this.users.find((user) => user.id === where.id));
        }

        return null;
      },
      findMany: async ({
        skip = 0,
        take = this.users.length,
        where,
        orderBy,
      }: {
        skip?: number;
        take?: number;
        where?: { disabled?: boolean };
        orderBy?: { createdAt?: 'asc' | 'desc' };
      }) => {
        let collection = [...this.users];

        if (typeof where?.disabled === 'boolean') {
          collection = collection.filter((user) => user.disabled === where.disabled);
        }

        if (orderBy?.createdAt === 'desc') {
          collection.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        } else if (orderBy?.createdAt === 'asc') {
          collection.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        }

        return collection.slice(skip, skip + take).map((user) => this.cloneUser(user));
      },
      count: async ({ where }: { where?: { disabled?: boolean } } = {}) => {
        let collection = [...this.users];
        if (typeof where?.disabled === 'boolean') {
          collection = collection.filter((user) => user.disabled === where.disabled);
        }
        return collection.length;
      },
      create: async ({
        data,
        include,
      }: {
        data: {
          email: string;
          name: string;
          role: Role;
          passwordHash: string;
          disabled?: boolean;
          permissions?: { create?: Array<{ resource: Resource; read: boolean; write: boolean }> };
        };
        include?: { permissions?: boolean };
      }) => {
        if (this.users.some((user) => user.email === data.email)) {
          throw new Error('Unique constraint failed on the fields: (`email`)');
        }

        const now = new Date();
        const permissionPayload =
          data.permissions?.create ??
          Object.values(Resource).map((resource) => ({
            resource,
            read: true,
            write: data.role === Role.admin,
          }));

        const record: UserRecord = {
          id: randomUUID(),
          email: data.email,
          name: data.name,
          role: data.role,
          passwordHash: data.passwordHash,
          disabled: data.disabled ?? false,
          createdAt: now,
          updatedAt: now,
          permissions: permissionPayload.map((permission) => ({
            id: randomUUID(),
            resource: permission.resource,
            read: permission.read,
            write: permission.write,
          })),
        };

        this.users.push(record);

        if (include?.permissions) {
          return this.cloneUser(record);
        }

        const { permissions, ...rest } = record;
        return { ...rest };
      },
    };
  }

  get product() {
    return {
      create: async ({ data }: { data: Partial<ProductRecord> }) => {
        const now = new Date();
        const record: ProductRecord = {
          id: randomUUID(),
          code: data.code ?? randomUUID(),
          name: data.name ?? '제품',
          description: data.description ?? undefined,
          specification: data.specification ?? undefined,
          unit: data.unit ?? 'EA',
          safetyStock: data.safetyStock ?? 0,
          totalIn: 0,
          totalOut: 0,
          totalReturn: 0,
          remain: 0,
          status: ProductStatus.normal,
          disabled: data.disabled ?? false,
          createdAt: now,
          updatedAt: now,
        };

        this.products.push(record);
        return { ...record };
      },
      findUnique: async ({ where: { id } }: { where: { id: string } }) => {
        const product = this.products.find((item) => item.id === id);
        return product ? { ...product } : null;
      },
      update: async ({ where: { id }, data }: { where: { id: string }; data: Partial<ProductRecord> }) => {
        const product = this.products.find((item) => item.id === id);
        if (!product) {
          throw new Error('Product not found');
        }

        Object.assign(product, data, { updatedAt: new Date() });
        return { ...product };
      },
      findMany: async ({
        where,
        skip = 0,
        take,
        orderBy,
      }: {
        where?: { disabled?: boolean; status?: ProductStatus };
        skip?: number;
        take?: number;
        orderBy?:
          | Array<{ name?: 'asc' | 'desc'; remain?: 'asc' | 'desc'; createdAt?: 'asc' | 'desc' }>
          | { name?: 'asc' | 'desc'; remain?: 'asc' | 'desc'; createdAt?: 'asc' | 'desc' };
      } = {}) => {
        let collection = [...this.products];

        if (typeof where?.disabled === 'boolean') {
          collection = collection.filter((product) => product.disabled === where.disabled);
        }

        if (where?.status) {
          collection = collection.filter((product) => product.status === where.status);
        }

        const sorters = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];

        if (sorters.length > 0) {
          const directions: Record<'asc' | 'desc', 1 | -1> = { asc: 1, desc: -1 };
          collection.sort((a, b) => {
            for (const sorter of sorters) {
              if (sorter.name) {
                const compare = a.name.localeCompare(b.name) * directions[sorter.name];
                if (compare !== 0) {
                  return compare;
                }
              }

              if (sorter.remain) {
                const compare = (a.remain - b.remain) * directions[sorter.remain];
                if (compare !== 0) {
                  return compare;
                }
              }

              if (sorter.createdAt) {
                const compare = (a.createdAt.getTime() - b.createdAt.getTime()) * directions[sorter.createdAt];
                if (compare !== 0) {
                  return compare;
                }
              }
            }

            return 0;
          });
        }

        const limit = typeof take === 'number' ? take : collection.length;
        return collection.slice(skip, skip + limit).map((product) => ({ ...product }));
      },
      count: async ({ where }: { where?: { disabled?: boolean; status?: ProductStatus } } = {}) => {
        let collection = [...this.products];
        if (typeof where?.disabled === 'boolean') {
          collection = collection.filter((product) => product.disabled === where.disabled);
        }
        if (where?.status) {
          collection = collection.filter((product) => product.status === where.status);
        }
        return collection.length;
      },
      aggregate: async ({ where }: { where?: { disabled?: boolean; status?: ProductStatus } } = {}) => {
        let collection = [...this.products];
        if (typeof where?.disabled === 'boolean') {
          collection = collection.filter((product) => product.disabled === where.disabled);
        }
        if (where?.status) {
          collection = collection.filter((product) => product.status === where.status);
        }

        return {
          _sum: collection.reduce(
            (acc, product) => ({
              totalIn: acc.totalIn + product.totalIn,
              totalOut: acc.totalOut + product.totalOut,
              totalReturn: acc.totalReturn + product.totalReturn,
            }),
            { totalIn: 0, totalOut: 0, totalReturn: 0 },
          ),
        };
      },
    };
  }

  get inbound() {
    return {
      findMany: async ({
        where,
        skip = 0,
        take = this.inbounds.length,
        orderBy,
        include,
      }: {
        where?: { productId?: string };
        skip?: number;
        take?: number;
        orderBy?: { dateIn?: 'asc' | 'desc' };
        include?: { product?: boolean };
      }) => {
        let collection = [...this.inbounds];

        if (where?.productId) {
          collection = collection.filter((record) => record.productId === where.productId);
        }

        if (orderBy?.dateIn === 'desc') {
          collection.sort((a, b) => b.dateIn.getTime() - a.dateIn.getTime());
        } else if (orderBy?.dateIn === 'asc') {
          collection.sort((a, b) => a.dateIn.getTime() - b.dateIn.getTime());
        }

        return collection.slice(skip, skip + take).map((record) =>
          include?.product ? { ...record, product: this.findProduct(record.productId) } : { ...record },
        );
      },
      count: async ({ where }: { where?: { productId?: string } } = {}) => {
        let collection = [...this.inbounds];
        if (where?.productId) {
          collection = collection.filter((record) => record.productId === where.productId);
        }
        return collection.length;
      },
      create: async ({
        data,
        include,
      }: {
        data: { productId: string; quantity: number; dateIn?: Date; note?: string | null };
        include?: { product?: boolean };
      }) => {
        const record: InboundRecord = {
          id: randomUUID(),
          productId: data.productId,
          quantity: data.quantity,
          dateIn: data.dateIn ?? new Date(),
          note: data.note ?? null,
          createdAt: new Date(),
        };

        this.inbounds.push(record);

        return include?.product ? { ...record, product: this.findProduct(record.productId) } : { ...record };
      },
      findUnique: async ({ where: { id }, include }: { where: { id: string }; include?: { product?: boolean } }) => {
        const record = this.inbounds.find((item) => item.id === id);
        if (!record) {
          return null;
        }

        return include?.product ? { ...record, product: this.findProduct(record.productId) } : { ...record };
      },
      update: async ({
        where: { id },
        data,
        include,
      }: {
        where: { id: string };
        data: Partial<Omit<InboundRecord, 'id' | 'createdAt'>>;
        include?: { product?: boolean };
      }) => {
        const record = this.inbounds.find((item) => item.id === id);
        if (!record) {
          throw new Error('Inbound not found');
        }

        Object.assign(record, data);

        return include?.product ? { ...record, product: this.findProduct(record.productId) } : { ...record };
      },
      delete: async ({ where: { id } }: { where: { id: string } }) => {
        const index = this.inbounds.findIndex((item) => item.id === id);
        if (index === -1) {
          throw new Error('Inbound not found');
        }

        const [removed] = this.inbounds.splice(index, 1);
        return { ...removed };
      },
    };
  }

  get outbound() {
    return {
      findMany: async ({
        where,
        skip = 0,
        take = this.outbounds.length,
        orderBy,
        include,
      }: {
        where?: { productId?: string };
        skip?: number;
        take?: number;
        orderBy?: { dateOut?: 'asc' | 'desc' };
        include?: { product?: boolean };
      }) => {
        let collection = [...this.outbounds];

        if (where?.productId) {
          collection = collection.filter((record) => record.productId === where.productId);
        }

        if (orderBy?.dateOut === 'desc') {
          collection.sort((a, b) => b.dateOut.getTime() - a.dateOut.getTime());
        } else if (orderBy?.dateOut === 'asc') {
          collection.sort((a, b) => a.dateOut.getTime() - b.dateOut.getTime());
        }

        return collection.slice(skip, skip + take).map((record) =>
          include?.product ? { ...record, product: this.findProduct(record.productId) } : { ...record },
        );
      },
      count: async ({ where }: { where?: { productId?: string } } = {}) => {
        let collection = [...this.outbounds];
        if (where?.productId) {
          collection = collection.filter((record) => record.productId === where.productId);
        }
        return collection.length;
      },
      create: async ({
        data,
        include,
      }: {
        data: { productId: string; quantity: number; dateOut?: Date; note?: string | null };
        include?: { product?: boolean };
      }) => {
        const record: OutboundRecord = {
          id: randomUUID(),
          productId: data.productId,
          quantity: data.quantity,
          dateOut: data.dateOut ?? new Date(),
          note: data.note ?? null,
          createdAt: new Date(),
        };

        this.outbounds.push(record);

        return include?.product ? { ...record, product: this.findProduct(record.productId) } : { ...record };
      },
      findUnique: async ({ where: { id }, include }: { where: { id: string }; include?: { product?: boolean } }) => {
        const record = this.outbounds.find((item) => item.id === id);
        if (!record) {
          return null;
        }

        return include?.product ? { ...record, product: this.findProduct(record.productId) } : { ...record };
      },
      update: async ({
        where: { id },
        data,
        include,
      }: {
        where: { id: string };
        data: Partial<Omit<OutboundRecord, 'id' | 'createdAt'>>;
        include?: { product?: boolean };
      }) => {
        const record = this.outbounds.find((item) => item.id === id);
        if (!record) {
          throw new Error('Outbound not found');
        }

        Object.assign(record, data);

        return include?.product ? { ...record, product: this.findProduct(record.productId) } : { ...record };
      },
      delete: async ({ where: { id } }: { where: { id: string } }) => {
        const index = this.outbounds.findIndex((item) => item.id === id);
        if (index === -1) {
          throw new Error('Outbound not found');
        }

        const [removed] = this.outbounds.splice(index, 1);
        return { ...removed };
      },
    };
  }

  get returnRecord() {
    return {
      findMany: async ({
        where,
        skip = 0,
        take = this.returnRecords.length,
        orderBy,
        include,
      }: {
        where?: { productId?: string; status?: ReturnStatus };
        skip?: number;
        take?: number;
        orderBy?: { dateReturn?: 'asc' | 'desc' };
        include?: { product?: boolean };
      }) => {
        let collection = [...this.returnRecords];

        if (where?.productId) {
          collection = collection.filter((record) => record.productId === where.productId);
        }

        if (where?.status) {
          collection = collection.filter((record) => record.status === where.status);
        }

        if (orderBy?.dateReturn === 'desc') {
          collection.sort((a, b) => b.dateReturn.getTime() - a.dateReturn.getTime());
        } else if (orderBy?.dateReturn === 'asc') {
          collection.sort((a, b) => a.dateReturn.getTime() - b.dateReturn.getTime());
        }

        return collection.slice(skip, skip + take).map((record) =>
          include?.product ? { ...record, product: this.findProduct(record.productId) } : { ...record },
        );
      },
      count: async ({ where }: { where?: { productId?: string; status?: ReturnStatus } } = {}) => {
        let collection = [...this.returnRecords];

        if (where?.productId) {
          collection = collection.filter((record) => record.productId === where.productId);
        }

        if (where?.status) {
          collection = collection.filter((record) => record.status === where.status);
        }

        return collection.length;
      },
      create: async ({
        data,
        include,
      }: {
        data: {
          productId: string;
          quantity: number;
          dateReturn?: Date;
          reason: string;
          status?: ReturnStatus;
        };
        include?: { product?: boolean };
      }) => {
        const record: ReturnRecordStub = {
          id: randomUUID(),
          productId: data.productId,
          quantity: data.quantity,
          dateReturn: data.dateReturn ?? new Date(),
          reason: data.reason,
          status: data.status ?? ReturnStatus.pending,
          createdAt: new Date(),
        };

        this.returnRecords.push(record);

        return include?.product ? { ...record, product: this.findProduct(record.productId) } : { ...record };
      },
      findUnique: async ({ where: { id }, include }: { where: { id: string }; include?: { product?: boolean } }) => {
        const record = this.returnRecords.find((item) => item.id === id);
        if (!record) {
          return null;
        }

        return include?.product ? { ...record, product: this.findProduct(record.productId) } : { ...record };
      },
      update: async ({
        where: { id },
        data,
        include,
      }: {
        where: { id: string };
        data: Partial<Omit<ReturnRecordStub, 'id' | 'createdAt'>>;
        include?: { product?: boolean };
      }) => {
        const record = this.returnRecords.find((item) => item.id === id);
        if (!record) {
          throw new Error('Return not found');
        }

        Object.assign(record, data);

        return include?.product ? { ...record, product: this.findProduct(record.productId) } : { ...record };
      },
      delete: async ({ where: { id } }: { where: { id: string } }) => {
        const index = this.returnRecords.findIndex((item) => item.id === id);
        if (index === -1) {
          throw new Error('Return not found');
        }

        const [removed] = this.returnRecords.splice(index, 1);
        return { ...removed };
      },
    };
  }

  get notificationSettingModel() {
    return {
      findUnique: async ({ where: { id }, include }: { where: { id: string }; include?: { telegramTargets?: boolean } }) => {
        if (this.notificationSettingRecord.id !== id) {
          return null;
        }

        return this.composeNotificationSetting(include);
      },
      findUniqueOrThrow: async ({ where: { id }, include }: { where: { id: string }; include?: { telegramTargets?: boolean } }) => {
        if (this.notificationSettingRecord.id !== id) {
          throw new Error('Notification setting not found');
        }

        return this.composeNotificationSetting(include);
      },
      create: async ({ data, include }: { data: Partial<NotificationSettingRecord>; include?: { telegramTargets?: boolean } }) => {
        if (!this.notificationSettingRecord) {
          const now = new Date();
          this.notificationSettingRecord = {
            id: data.id ?? randomUUID(),
            telegramEnabled: data.telegramEnabled ?? true,
            telegramCooldownMin: data.telegramCooldownMin ?? 60,
            telegramQuietHours: data.telegramQuietHours ?? '22-07',
            telegramBotToken: data.telegramBotToken ?? null,
            createdById: data.createdById ?? null,
            createdAt: now,
            updatedAt: now,
          };
        }

        return this.composeNotificationSetting(include);
      },
      upsert: async ({
        update,
        create,
      }: {
        update: Partial<NotificationSettingRecord>;
        create: Partial<NotificationSettingRecord>;
      }) => {
        if (this.notificationSettingRecord) {
          Object.assign(this.notificationSettingRecord, update ?? {}, { updatedAt: new Date() });
          return { ...this.notificationSettingRecord };
        }

        const now = new Date();
        this.notificationSettingRecord = {
          id: create.id ?? randomUUID(),
          telegramEnabled: create.telegramEnabled ?? true,
          telegramCooldownMin: create.telegramCooldownMin ?? 60,
          telegramQuietHours: create.telegramQuietHours ?? '22-07',
          telegramBotToken: create.telegramBotToken ?? null,
          createdById: create.createdById ?? null,
          createdAt: now,
          updatedAt: now,
        };

        return { ...this.notificationSettingRecord };
      },
    };
  }

  get telegramTargetModel() {
    return {
      deleteMany: async ({ where: { settingId } }: { where: { settingId: string } }) => {
        this.telegramTargets = this.telegramTargets.filter((target) => target.settingId !== settingId);
      },
      createMany: async ({ data }: { data: Array<Partial<TelegramTargetRecord>> }) => {
        const now = new Date();
        for (const payload of data) {
          this.telegramTargets.push({
            id: randomUUID(),
            chatId: payload.chatId ?? '',
            label: payload.label ?? null,
            enabled: payload.enabled ?? true,
            settingId: payload.settingId ?? this.notificationSettingRecord.id,
            createdAt: now,
          });
        }
      },
    };
  }

  get alert() {
    return {
      findMany: async ({
        where,
        skip = 0,
        take = this.alerts.length,
        orderBy,
        include,
      }: {
        where?: { productId?: string; level?: AlertLevel; channel?: Channel };
        skip?: number;
        take?: number;
        orderBy?: { createdAt?: 'asc' | 'desc' };
        include?: { product?: boolean };
      }) => {
        let filtered = [...this.alerts];

        if (where?.productId) {
          filtered = filtered.filter((alert) => alert.productId === where.productId);
        }
        if (where?.level) {
          filtered = filtered.filter((alert) => alert.level === where.level);
        }
        if (where?.channel) {
          filtered = filtered.filter((alert) => alert.channel === where.channel);
        }

        if (orderBy?.createdAt === 'desc') {
          filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        } else if (orderBy?.createdAt === 'asc') {
          filtered.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        }

        const slice = filtered.slice(skip, skip + take);

        return slice.map((alert) =>
          include?.product ? { ...alert, product: this.findProduct(alert.productId) } : { ...alert },
        );
      },
      count: async ({ where }: { where?: { productId?: string; level?: AlertLevel; channel?: Channel } } = {}) => {
        if (!where) {
          return this.alerts.length;
        }

        return this.alerts.filter((alert) => {
          if (where.productId && alert.productId !== where.productId) {
            return false;
          }
          if (where.level && alert.level !== where.level) {
            return false;
          }
          if (where.channel && alert.channel !== where.channel) {
            return false;
          }
          return true;
        }).length;
      },
      create: async ({
        data,
        include,
      }: {
        data: {
          productId?: string;
          level: AlertLevel;
          channel: Channel;
          message: string;
          dedupKey?: string | null;
          sentAt?: Date | null;
          retryAt?: Date | null;
          retryReason?: string | null;
          retryCount?: number;
        };
        include?: { product?: boolean };
      }) => {
        const record: AlertRecord = {
          id: randomUUID(),
          productId: data.productId,
          level: data.level,
          channel: data.channel,
          message: data.message,
          dedupKey: data.dedupKey ?? null,
          sentAt: data.sentAt ?? null,
          retryAt: data.retryAt ?? null,
          retryReason: data.retryReason ?? null,
          retryCount: data.retryCount ?? 0,
          createdAt: new Date(),
        };
        this.alerts.push(record);

        if (include?.product) {
          return { ...record, product: this.findProduct(record.productId) };
        }

        return { ...record };
      },
      findUnique: async ({ where: { id }, include }: { where: { id: string }; include?: { product?: boolean } }) => {
        const found = this.alerts.find((alert) => alert.id === id);
        if (!found) {
          return null;
        }

        return include?.product ? { ...found, product: this.findProduct(found.productId) } : { ...found };
      },
      update: async ({
        where: { id },
        data,
        include,
      }: {
        where: { id: string };
        data: Partial<Omit<AlertRecord, 'id' | 'createdAt'>>;
        include?: { product?: boolean };
      }) => {
        const found = this.alerts.find((alert) => alert.id === id);
        if (!found) {
          throw new Error('Alert not found');
        }

        Object.assign(found, data);

        return include?.product ? { ...found, product: this.findProduct(found.productId) } : { ...found };
      },
      findFirst: async ({ where }: { where: { productId?: string; channel?: Channel; sentAt?: { not: null } } }) => {
        const filtered = this.alerts
          .filter((alert) => {
            if (where.productId && alert.productId !== where.productId) {
              return false;
            }
            if (where.channel && alert.channel !== where.channel) {
              return false;
            }
            if (where.sentAt && where.sentAt.not === null) {
              return alert.sentAt != null;
            }
            return true;
          })
          .sort((a, b) => (b.sentAt?.getTime() ?? 0) - (a.sentAt?.getTime() ?? 0));

        const found = filtered[0];
        if (!found) {
          return null;
        }

        return { ...found };
      },
      deleteMany: async ({ where }: { where?: { productId?: string; channel?: Channel } } = {}) => {
        if (!where || (where.productId == null && where.channel == null)) {
          const deleted = this.alerts.length;
          this.alerts = [];
          return { count: deleted };
        }

        const before = this.alerts.length;
        this.alerts = this.alerts.filter((alert) => {
          if (where.productId && alert.productId !== where.productId) {
            return true;
          }
          if (where.channel && alert.channel !== where.channel) {
            return true;
          }
          return false;
        });
        return { count: before - this.alerts.length };
      },
    };
  }

  get notificationSetting() {
    return this.notificationSettingModel;
  }

  get telegramTarget() {
    return this.telegramTargetModel;
  }

  private composeNotificationSetting(include?: { telegramTargets?: boolean }) {
    return {
      ...this.notificationSettingRecord,
      telegramTargets: include?.telegramTargets
        ? this.telegramTargets.map((target) => ({ ...target }))
        : undefined,
    };
  }

  private findProduct(id?: string) {
    if (!id) {
      return null;
    }

    const product = this.products.find((item) => item.id === id);
    return product ? { ...product } : null;
  }

  private cloneUser(user?: UserRecord) {
    if (!user) {
      return null;
    }

    return {
      ...user,
      permissions: user.permissions.map((permission) => ({ ...permission })),
    };
  }

  addUser({
    email,
    name,
    role,
    password,
    disabled = false,
    permissions,
  }: {
    email: string;
    name?: string;
    role: Role;
    password: string;
    disabled?: boolean;
    permissions?: Array<{ resource: Resource; read: boolean; write: boolean }>;
  }) {
    const now = new Date();
    const permissionTemplates =
      permissions ??
      Object.values(Resource).map((resource) => ({
        resource,
        read: true,
        write: role === Role.admin,
      }));

    const record: UserRecord = {
      id: randomUUID(),
      email,
      name: name ?? '사용자',
      role,
      passwordHash: hashSync(password, 10),
      disabled,
      createdAt: now,
      updatedAt: now,
      permissions: permissionTemplates.map((permission) => ({
        id: randomUUID(),
        resource: permission.resource,
        read: permission.read,
        write: permission.write,
      })),
    };

    this.users.push(record);
    return this.cloneUser(record);
  }
}

class StubTelegramService {
  sentMessages: Array<{ chatId: string; text: string }> = [];

  async sendMessage({ chatId, text }: { chatId: string; text: string }) {
    this.sentMessages.push({ chatId, text });
  }
}

const operatorWritableResources = new Set<Resource>([
  Resource.products,
  Resource.inbounds,
  Resource.outbounds,
  Resource.returns,
]);

describe('AppModule e2e', () => {
  it('should execute core inventory flows', async () => {
    process.env.JWT_SECRET = 'test-secret';
    const useRealDatabase = process.env.E2E_USE_REAL_DB === 'true';

    const inMemoryPrisma = new InMemoryPrismaService();

    inMemoryPrisma.addUser({
      email: VIEWER_EMAIL,
      name: 'Viewer',
      role: Role.viewer,
      password: VIEWER_PASSWORD,
      permissions: Object.values(Resource).map((resource) => ({
        resource,
        read: resource !== Resource.settings,
        write: false,
      })),
    });

    inMemoryPrisma.addUser({
      email: OPERATOR_EMAIL,
      name: 'Operator',
      role: Role.operator,
      password: OPERATOR_PASSWORD,
      permissions: Object.values(Resource).map((resource) => ({
        resource,
        read: true,
        write: operatorWritableResources.has(resource),
      })),
    });

    const telegramStub = new StubTelegramService();

    const testingModuleBuilder = Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(TelegramService)
      .useValue(telegramStub);

    if (!useRealDatabase) {
      testingModuleBuilder.overrideProvider(PrismaService).useValue(inMemoryPrisma);
    }

    const moduleRef = await testingModuleBuilder.compile();

    let app: INestApplication | null = null;
    let prisma: PrismaService | null = null;

    try {
      app = moduleRef.createNestApplication();
      app.setGlobalPrefix('api/v1');
      app.enableCors();
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
          transformOptions: { enableImplicitConversion: true },
        }),
      );
      await app.init();

      const prismaService = moduleRef.get(PrismaService);
      prisma = prismaService;

      if (useRealDatabase) {
        await prismaService.$connect();
        await seedRealDatabase(prismaService);
      }

      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@example.com', password: 'ChangeMe123!' });

      if (!loginResponse.body.accessToken) {
        throw new Error('Access token not returned');
      }

      const token = loginResponse.body.accessToken as string;

      const viewerLoginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: VIEWER_EMAIL, password: VIEWER_PASSWORD })
        .expect(200);

      const viewerToken = viewerLoginResponse.body.accessToken as string;

      const operatorLoginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: OPERATOR_EMAIL, password: OPERATOR_PASSWORD })
        .expect(200);

      const operatorToken = operatorLoginResponse.body.accessToken as string;

  await request(app.getHttpServer())
    .get('/api/v1/auth/me')
    .set('Authorization', `Bearer ${viewerToken}`)
    .expect(200)
    .expect((res) => {
      if (res.body.email !== VIEWER_EMAIL) {
        throw new Error('viewer email mismatch');
      }
      if (res.body.role !== 'viewer') {
        throw new Error('viewer role mismatch');
      }
      if (!Array.isArray(res.body.permissions)) {
        throw new Error('permissions not returned');
      }
      const settingsPermission = res.body.permissions.find(
        (permission: { resource: string }) => permission.resource === 'settings',
      );
      if (!settingsPermission) {
        throw new Error('viewer permissions missing settings resource');
      }
      if (settingsPermission.read !== false || settingsPermission.write !== false) {
        throw new Error('viewer should not have settings permission');
      }
    });

  await request(app.getHttpServer())
    .get('/api/v1/auth/me')
    .set('Authorization', `Bearer ${operatorToken}`)
    .expect(200)
    .expect((res) => {
      if (res.body.email !== OPERATOR_EMAIL) {
        throw new Error('operator email mismatch');
      }
      if (res.body.role !== 'operator') {
        throw new Error('operator role mismatch');
      }
      const writable = res.body.permissions.filter(
        (permission: { write: boolean }) => permission.write,
      );
      if (writable.length === 0) {
        throw new Error('operator should have writable permissions');
      }
    });

  const productResponse = await request(app.getHttpServer())
    .post('/api/v1/products')
    .set('Authorization', `Bearer ${token}`)
    .send({
      code: 'SKU-NEW',
      name: '테스트 제품',
      safetyStock: 5,
    })
    .expect(201);

  const productId = productResponse.body.id as string;
  if (!productId) {
    throw new Error('product id missing');
  }

  await request(app.getHttpServer())
    .get('/api/v1/products')
    .set('Authorization', `Bearer ${token}`)
    .expect(200)
    .expect((res) => {
      if (!Array.isArray(res.body.data) || res.body.data.length === 0) {
        throw new Error('제품 목록이 비어 있습니다.');
      }
    });

  await request(app.getHttpServer())
    .get(`/api/v1/products/${productId}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200)
    .expect((res) => {
      if (res.body.id !== productId) {
        throw new Error('제품 상세 조회 실패');
      }
      if (res.body.remain !== 0) {
        throw new Error('초기 재고가 0이 아닙니다.');
      }
    });

  const inboundResponse = await request(app.getHttpServer())
    .post('/api/v1/inbounds')
    .set('Authorization', `Bearer ${operatorToken}`)
    .send({
      productId,
      quantity: 15,
      note: '초기 입고',
    })
    .expect(201);

  const inboundId = inboundResponse.body.id as string;
  if (!inboundId) {
    throw new Error('입고 ID가 없습니다.');
  }

  await request(app.getHttpServer())
    .get(`/api/v1/products/${productId}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200)
    .expect((res) => {
      if (res.body.remain !== 15) {
        throw new Error('입고 후 재고가 일치하지 않습니다.');
      }
    });

  await request(app.getHttpServer())
    .patch(`/api/v1/inbounds/${inboundId}`)
    .set('Authorization', `Bearer ${operatorToken}`)
    .send({ quantity: 18 })
    .expect(200);

  await request(app.getHttpServer())
    .get(`/api/v1/inbounds/${inboundId}`)
    .set('Authorization', `Bearer ${operatorToken}`)
    .expect(200)
    .expect((res) => {
      if (res.body.id !== inboundId) {
        throw new Error('입고 상세 조회 실패');
      }
      if (res.body.quantity !== 18) {
        throw new Error('입고 수량 업데이트 실패');
      }
    });

  await request(app.getHttpServer())
    .get('/api/v1/inbounds')
    .set('Authorization', `Bearer ${operatorToken}`)
    .expect(200)
    .expect((res) => {
      if (!Array.isArray(res.body.data) || res.body.data.length === 0) {
        throw new Error('입고 목록이 비어 있습니다.');
      }
    });

  await request(app.getHttpServer())
    .get(`/api/v1/products/${productId}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200)
    .expect((res) => {
      if (res.body.remain !== 18) {
        throw new Error('입고 수정 후 재고가 일치하지 않습니다.');
      }
    });

  const outboundResponse = await request(app.getHttpServer())
    .post('/api/v1/outbounds')
    .set('Authorization', `Bearer ${operatorToken}`)
    .send({
      productId,
      quantity: 5,
      note: '출고 테스트',
    })
    .expect(201);

  const outboundId = outboundResponse.body.id as string;
  if (!outboundId) {
    throw new Error('출고 ID가 없습니다.');
  }

  await request(app.getHttpServer())
    .get(`/api/v1/products/${productId}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200)
    .expect((res) => {
      if (res.body.remain !== 13) {
        throw new Error('출고 후 재고가 일치하지 않습니다.');
      }
    });

  await request(app.getHttpServer())
    .patch(`/api/v1/outbounds/${outboundId}`)
    .set('Authorization', `Bearer ${operatorToken}`)
    .send({ quantity: 7 })
    .expect(200);

  await request(app.getHttpServer())
    .get(`/api/v1/outbounds/${outboundId}`)
    .set('Authorization', `Bearer ${operatorToken}`)
    .expect(200)
    .expect((res) => {
      if (res.body.id !== outboundId) {
        throw new Error('출고 상세 조회 실패');
      }
      if (res.body.quantity !== 7) {
        throw new Error('출고 수량 업데이트 실패');
      }
    });

  await request(app.getHttpServer())
    .get(`/api/v1/products/${productId}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200)
    .expect((res) => {
      if (res.body.remain !== 11) {
        throw new Error('출고 수정 후 재고가 일치하지 않습니다.');
      }
    });

  const returnResponse = await request(app.getHttpServer())
    .post('/api/v1/returns')
    .set('Authorization', `Bearer ${operatorToken}`)
    .send({
      productId,
      quantity: 3,
      reason: '반품 사유',
      status: 'completed',
    })
    .expect(201);

  const returnId = returnResponse.body.id as string;
  if (!returnId) {
    throw new Error('반품 ID가 없습니다.');
  }

  await request(app.getHttpServer())
    .get(`/api/v1/products/${productId}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200)
    .expect((res) => {
      if (res.body.remain !== 14) {
        throw new Error('반품 등록 후 재고가 일치하지 않습니다.');
      }
    });

  await request(app.getHttpServer())
    .patch(`/api/v1/returns/${returnId}`)
    .set('Authorization', `Bearer ${operatorToken}`)
    .send({ quantity: 4 })
    .expect(200);

  await request(app.getHttpServer())
    .get(`/api/v1/returns/${returnId}`)
    .set('Authorization', `Bearer ${operatorToken}`)
    .expect(200)
    .expect((res) => {
      if (res.body.quantity !== 4) {
        throw new Error('반품 수량 업데이트 실패');
      }
    });

  await request(app.getHttpServer())
    .get(`/api/v1/products/${productId}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200)
    .expect((res) => {
      if (res.body.remain !== 15) {
        throw new Error('반품 수정 후 재고가 일치하지 않습니다.');
      }
    });

  await request(app.getHttpServer())
    .patch(`/api/v1/returns/${returnId}/status`)
    .set('Authorization', `Bearer ${operatorToken}`)
    .send({ status: 'pending' })
    .expect(200);

  await request(app.getHttpServer())
    .get(`/api/v1/products/${productId}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200)
    .expect((res) => {
      if (res.body.remain !== 11) {
        throw new Error('반품 상태 변경 후 재고가 일치하지 않습니다.');
      }
    });

  await request(app.getHttpServer())
    .delete(`/api/v1/returns/${returnId}`)
    .set('Authorization', `Bearer ${operatorToken}`)
    .expect(200)
    .expect((res) => {
      if (!res.body.success) {
        throw new Error('반품 삭제 실패');
      }
    });

  await request(app.getHttpServer())
    .delete(`/api/v1/outbounds/${outboundId}`)
    .set('Authorization', `Bearer ${operatorToken}`)
    .expect(200);

  await request(app.getHttpServer())
    .delete(`/api/v1/inbounds/${inboundId}`)
    .set('Authorization', `Bearer ${operatorToken}`)
    .expect(200);

  await request(app.getHttpServer())
    .get(`/api/v1/products/${productId}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200)
    .expect((res) => {
      if (res.body.remain !== 0) {
        throw new Error('입출반 삭제 후 재고가 초기화되지 않았습니다.');
      }
    });

  await request(app.getHttpServer())
    .get('/api/v1/inbounds')
    .set('Authorization', `Bearer ${operatorToken}`)
    .expect(200)
    .expect((res) => {
      if (!Array.isArray(res.body.data) || res.body.data.length !== 0) {
        throw new Error('입고 목록이 비어 있어야 합니다.');
      }
    });

  await request(app.getHttpServer())
    .get('/api/v1/outbounds')
    .set('Authorization', `Bearer ${operatorToken}`)
    .expect(200)
    .expect((res) => {
      if (!Array.isArray(res.body.data) || res.body.data.length !== 0) {
        throw new Error('출고 목록이 비어 있어야 합니다.');
      }
    });

  await request(app.getHttpServer())
    .get('/api/v1/returns')
    .set('Authorization', `Bearer ${operatorToken}`)
    .expect(200)
    .expect((res) => {
      if (!Array.isArray(res.body.data) || res.body.data.length !== 0) {
        throw new Error('반품 목록이 비어 있어야 합니다.');
      }
    });

  await request(app.getHttpServer())
    .get('/api/v1/users')
    .set('Authorization', `Bearer ${viewerToken}`)
    .expect(403);

  await request(app.getHttpServer())
    .get('/api/v1/users')
    .set('Authorization', `Bearer ${operatorToken}`)
    .expect(200)
    .expect((res) => {
      if (!Array.isArray(res.body.data) || res.body.data.length === 0) {
        throw new Error('operator cannot see users list');
      }
    });

  await request(app.getHttpServer())
    .get('/api/v1/users')
    .set('Authorization', `Bearer ${token}`)
    .expect(200)
    .expect((res) => {
      if (!Array.isArray(res.body.data) || res.body.data.length === 0) {
        throw new Error('사용자 목록이 비어 있습니다.');
      }
    });

  await request(app.getHttpServer())
    .get('/api/v1/permissions/templates')
    .set('Authorization', `Bearer ${viewerToken}`)
    .expect(403);

  await request(app.getHttpServer())
    .get('/api/v1/permissions/templates')
    .set('Authorization', `Bearer ${operatorToken}`)
    .expect(200)
    .expect((res) => {
      if (!res.body.data || !res.body.data.operator) {
        throw new Error('operator permission template missing');
      }
    });

  await request(app.getHttpServer())
    .post('/api/v1/users')
    .set('Authorization', `Bearer ${operatorToken}`)
    .send({
      email: 'reader@example.com',
      name: 'Reader',
      role: 'viewer',
      password: 'Reader123!',
      permissions: [
        {
          resource: 'products',
          read: true,
          write: false,
        },
      ],
    })
    .expect(403);

  await request(app.getHttpServer())
    .post('/api/v1/users')
    .set('Authorization', `Bearer ${token}`)
    .send({
      email: 'new.staff@example.com',
      name: 'New Staff',
      role: 'operator',
      password: 'StaffPass123!',
    })
    .expect(201)
    .expect((res) => {
      if (!res.body || res.body.email !== 'new.staff@example.com') {
        throw new Error('admin user creation failed');
      }
    });

  await request(app.getHttpServer())
    .get('/api/v1/users')
    .set('Authorization', `Bearer ${token}`)
    .expect(200)
    .expect((res) => {
      const hasNewUser = Array.isArray(res.body.data)
        ? res.body.data.some((user: { email: string }) => user.email === 'new.staff@example.com')
        : false;
      if (!hasNewUser) {
        throw new Error('created user not found in listing');
      }
    });

  await request(app.getHttpServer())
    .get('/api/v1/permissions/templates')
    .set('Authorization', `Bearer ${token}`)
    .expect(200)
    .expect((res) => {
      if (!res.body.data || !res.body.data.admin) {
        throw new Error('권한 템플릿 응답이 올바르지 않습니다.');
      }
    });

  await request(app.getHttpServer())
    .post('/api/v1/alerts/test')
    .set('Authorization', `Bearer ${token}`)
    .expect(200)
    .expect((res) => {
      if (!res.body.decision) {
        throw new Error('알림 정책 결과가 없습니다.');
      }
    });

  if (telegramStub.sentMessages.length === 0) {
    throw new Error('텔레그램 전송이 호출되지 않았습니다.');
  }

  const healthResponse = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
  expect(healthResponse.body).toHaveProperty('status');
  expect(healthResponse.body).toHaveProperty('services.database.status');

  telegramStub.sentMessages = [];

  const updateQuietHoursPayload = {
    enabled: true,
    botToken: 'test-token',
    cooldownMinutes: 1,
    quietHours: '00-23',
    targets: [
      {
        chatId: '123456',
        label: '운영팀',
        enabled: true,
      },
    ],
  };

  await request(app.getHttpServer())
    .put('/api/v1/settings/notifications/telegram')
    .set('Authorization', `Bearer ${token}`)
    .send(updateQuietHoursPayload)
    .expect(200);

  const deferredResponse = await request(app.getHttpServer())
    .post('/api/v1/alerts/test')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  if (deferredResponse.body.success !== false || deferredResponse.body.decision?.reason !== 'quiet_hours') {
    throw new Error('조용시간 정책이 적용되어야 합니다.');
  }

  const pendingAlerts = await prisma.alert.findMany({ where: { sentAt: null } });

  if (!Array.isArray(pendingAlerts) || pendingAlerts.length === 0) {
    throw new Error('지연 알림이 생성되지 않았습니다.');
  }

  const pendingAlert = pendingAlerts[pendingAlerts.length - 1];

  if (!pendingAlert.retryAt) {
    throw new Error('지연 알림에 재시도 시간이 설정되지 않았습니다.');
  }

  if (pendingAlert.retryReason !== 'quiet_hours') {
    throw new Error('지연 알림의 사유가 quiet_hours 이어야 합니다.');
  }

  await (prisma.alert as any).update({
    where: { id: pendingAlert.id },
    data: { retryAt: new Date(Date.now() - 60 * 1000) },
  });

  await request(app.getHttpServer())
    .put('/api/v1/settings/notifications/telegram')
    .set('Authorization', `Bearer ${token}`)
    .send({ ...updateQuietHoursPayload, quietHours: '23-23' })
    .expect(200);

  const alertsService = moduleRef.get(AlertsService);
  const retryResult = await alertsService.processPendingAlert(pendingAlert.id);

  if (retryResult !== 'sent') {
    throw new Error('지연 알림 재시도가 성공적으로 처리되지 않았습니다.');
  }

  if (telegramStub.sentMessages.length === 0) {
    throw new Error('지연 알림 재시도 후에도 텔레그램 전송이 호출되지 않았습니다.');
  }

  const refreshedAlert = await prisma.alert.findUnique({ where: { id: pendingAlert.id } });

  if (!refreshedAlert?.sentAt) {
    throw new Error('재시도 후 알림이 발송 완료 상태가 아닙니다.');
  }

  if (refreshedAlert.retryAt != null || refreshedAlert.retryReason != null) {
    throw new Error('재시도 후 알림의 재시도 메타데이터가 초기화되지 않았습니다.');
  }

    } finally {
      if (app) {
        await app.close();
      }

      if (useRealDatabase && prisma) {
        await prisma.$disconnect();
      }
    }
  });
});

async function seedRealDatabase(prisma: PrismaService) {
  await prisma.alert.deleteMany();
  await prisma.inbound.deleteMany();
  await prisma.outbound.deleteMany();
  await prisma.returnRecord.deleteMany();
  await prisma.product.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.user.deleteMany();
  await prisma.telegramTarget.deleteMany();
  await prisma.notificationSetting.deleteMany();

  const admin = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      name: 'Admin',
      role: Role.admin,
      passwordHash: hashSync('ChangeMe123!', 10),
      disabled: false,
      permissions: {
        create: Object.values(Resource).map((resource) => ({
          resource,
          read: true,
          write: true,
        })),
      },
    },
  });

  await prisma.user.create({
    data: {
      email: VIEWER_EMAIL,
      name: 'Viewer',
      role: Role.viewer,
      passwordHash: hashSync(VIEWER_PASSWORD, 10),
      disabled: false,
      permissions: {
        create: Object.values(Resource).map((resource) => ({
          resource,
          read: resource !== Resource.settings,
          write: false,
        })),
      },
    },
  });

  await prisma.user.create({
    data: {
      email: OPERATOR_EMAIL,
      name: 'Operator',
      role: Role.operator,
      passwordHash: hashSync(OPERATOR_PASSWORD, 10),
      disabled: false,
      permissions: {
        create: Object.values(Resource).map((resource) => ({
          resource,
          read: true,
          write: operatorWritableResources.has(resource),
        })),
      },
    },
  });

  const setting = await prisma.notificationSetting.create({
    data: {
      id: 'default-notification-setting',
      telegramEnabled: true,
      telegramCooldownMin: 60,
      telegramQuietHours: '22-07',
      telegramBotToken: 'test-token',
      createdById: admin.id,
    },
  });

  await prisma.telegramTarget.create({
    data: {
      chatId: '123456',
      label: '운영팀',
      enabled: true,
      settingId: setting.id,
    },
  });
}
