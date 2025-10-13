import { Inbound, Product } from '@prisma/client';

export interface InboundEntity {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  quantity: number;
  dateIn: Date;
  note?: string;
  createdAt: Date;
}

export function toInboundEntity(record: Inbound & { product: Product }): InboundEntity {
  return {
    id: record.id,
    productId: record.productId,
    productCode: record.product.code,
    productName: record.product.name,
    quantity: record.quantity,
    dateIn: record.dateIn,
    note: record.note ?? undefined,
    createdAt: record.createdAt,
  };
}
