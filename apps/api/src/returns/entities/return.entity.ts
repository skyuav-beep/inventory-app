import { Outbound, Product, ReturnRecord, ReturnStatus } from '@prisma/client';

export interface ReturnEntity {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  quantity: number;
  reason: string;
  status: ReturnStatus;
  dateReturn: Date;
  outboundId?: string;
  dateOut?: Date;
  ordererId?: string;
  ordererName?: string;
  createdAt: Date;
}

export function toReturnEntity(
  record: ReturnRecord & { product: Product; outbound?: Outbound | null },
): ReturnEntity {
  return {
    id: record.id,
    productId: record.productId,
    productCode: record.product.code,
    productName: record.product.name,
    quantity: record.quantity,
    reason: record.reason,
    status: record.status,
    dateReturn: record.dateReturn,
    outboundId: record.outboundId ?? undefined,
    dateOut: record.outbound?.dateOut,
    ordererId: record.outbound?.ordererId ?? undefined,
    ordererName: record.outbound?.ordererName ?? undefined,
    createdAt: record.createdAt,
  };
}
