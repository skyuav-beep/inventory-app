import { $Enums, Outbound, Product } from '@prisma/client';

export interface OutboundEntity {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  productUnit: string;
  quantity: number;
  dateOut: Date;
  status: $Enums.OutboundStatus;
  orderDate?: Date;
  ordererId?: string;
  ordererName?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientAddress?: string;
  recipientPostalCode?: string;
  customsNumber?: string;
  invoiceNumber?: string;
  note?: string;
  createdAt: Date;
}

export function toOutboundEntity(record: Outbound & { product: Product }): OutboundEntity {
  return {
    id: record.id,
    productId: record.productId,
    productCode: record.product.code,
    productName: record.product.name,
    productUnit: record.product.unit,
    quantity: record.quantity,
    dateOut: record.dateOut,
    status: record.status,
    orderDate: record.orderDate ?? undefined,
    ordererId: record.ordererId ?? undefined,
    ordererName: record.ordererName ?? undefined,
    recipientName: record.recipientName ?? undefined,
    recipientPhone: record.recipientPhone ?? undefined,
    recipientAddress: record.recipientAddress ?? undefined,
    recipientPostalCode: record.recipientPostalCode ?? undefined,
    customsNumber: record.customsNumber ?? undefined,
    invoiceNumber: record.invoiceNumber ?? undefined,
    note: record.note ?? undefined,
    createdAt: record.createdAt,
  };
}
