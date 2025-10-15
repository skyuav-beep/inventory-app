import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, Prisma, Resource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
