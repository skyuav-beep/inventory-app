import { Alert, AlertLevel, Channel, Product } from '@prisma/client';

export interface AlertEntity {
  id: string;
  productId?: string;
  productCode?: string;
  productName?: string;
  level: AlertLevel;
  channel: Channel;
  message: string;
  dedupKey?: string;
  sentAt?: Date;
  createdAt: Date;
}

export function toAlertEntity(alert: Alert & { product?: Product | null }): AlertEntity {
  return {
    id: alert.id,
    productId: alert.productId ?? undefined,
    productCode: alert.product?.code ?? undefined,
    productName: alert.product?.name ?? undefined,
    level: alert.level,
    channel: alert.channel,
    message: alert.message,
    dedupKey: alert.dedupKey ?? undefined,
    sentAt: alert.sentAt ?? undefined,
    createdAt: alert.createdAt,
  };
}
