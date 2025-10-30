import { AuditAction, AuditLog, Resource, User } from '@prisma/client';
import { Prisma } from '@prisma/client';

export interface AuditLogEntity {
  id: string;
  resource: Resource;
  action: AuditAction;
  entityId?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  payload?: Prisma.JsonValue;
  createdAt: Date;
}

export type AuditLogWithUser = AuditLog & { user: Pick<User, 'id' | 'name' | 'email'> | null };

export function toAuditLogEntity(log: AuditLogWithUser): AuditLogEntity {
  return {
    id: log.id,
    resource: log.resource,
    action: log.action,
    entityId: log.entityId ?? undefined,
    userId: log.user?.id ?? undefined,
    userName: log.user?.name ?? undefined,
    userEmail: log.user?.email ?? undefined,
    ipAddress: log.ipAddress ?? undefined,
    userAgent: log.userAgent ?? undefined,
    payload: log.payloadJson ?? undefined,
    createdAt: log.createdAt,
  };
}
