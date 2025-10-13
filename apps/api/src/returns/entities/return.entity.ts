import { Product, ReturnRecord, ReturnStatus } from '@prisma/client';

export interface ReturnEntity {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  quantity: number;
  reason: string;
  status: ReturnStatus;
  dateReturn: Date;
  createdAt: Date;
}

export function toReturnEntity(record: ReturnRecord & { product: Product }): ReturnEntity {
  return {
    id: record.id,
    productId: record.productId,
    productCode: record.product.code,
    productName: record.product.name,
    quantity: record.quantity,
    reason: record.reason,
    status: record.status,
    dateReturn: record.dateReturn,
    createdAt: record.createdAt,
  };
}
