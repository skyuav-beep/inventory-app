import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, Prisma, Resource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogEntity, AuditLogWithUser, toAuditLogEntity } from './entities/audit-log.entity';

export interface AuditRecord {
  userId?: string;
  resource: Resource;
  action: AuditAction;
  entityId?: string;
  payload?: Prisma.JsonValue;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listLogs(params: {
    page: number;
    size: number;
    resource?: Resource;
    action?: AuditAction;
  }): Promise<{ data: AuditLogEntity[]; total: number }> {
    const page = params.page > 0 ? params.page : 1;
    const size = params.size > 0 ? params.size : 20;
    const skip = (page - 1) * size;

    const where: Prisma.AuditLogWhereInput = {};

    if (params.resource) {
      where.resource = params.resource;
    }

    if (params.action) {
      where.action = params.action;
    }

    const [logs, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: size,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs.map((log: AuditLogWithUser) => toAuditLogEntity(log)),
      total,
    };
  }

  async record(record: AuditRecord): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: record.userId ?? null,
          resource: record.resource,
          action: record.action,
          entityId: record.entityId,
          payloadJson: record.payload ?? undefined,
          ipAddress: record.ipAddress,
          userAgent: record.userAgent,
        },
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`감사 로그 저장 실패: ${reason}`);
    }
  }
}
