import { Outbound, Product } from '@prisma/client';

export interface OutboundEntity {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  quantity: number;
  dateOut: Date;
  note?: string;
  createdAt: Date;
}

export function toOutboundEntity(record: Outbound & { product: Product }): OutboundEntity {
  return {
    id: record.id,
    productId: record.productId,
    productCode: record.product.code,
    productName: record.product.name,
    quantity: record.quantity,
    dateOut: record.dateOut,
    note: record.note ?? undefined,
    createdAt: record.createdAt,
  };
}
