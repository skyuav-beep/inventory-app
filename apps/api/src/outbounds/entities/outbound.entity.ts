import { $Enums, Outbound, Product, ReturnRecord } from '@prisma/client';

export interface OutboundEntity {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  productUnit: string;
  quantity: number;
  dateOut: Date;
  status: $Enums.OutboundStatus;
  ordererName?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientAddress?: string;
  recipientPostalCode?: string;
  invoiceNumber?: string;
  freightType?: string;
  paymentCondition?: string;
  specialNote?: string;
  memo?: string;
  returnedQuantity: number;
  returnableQuantity: number;
  createdAt: Date;
}

type OutboundWithRelations = Outbound & {
  product: Product;
  returns?: Array<Pick<ReturnRecord, 'quantity' | 'status'>>;
};

export function toOutboundEntity(record: OutboundWithRelations): OutboundEntity {
  const returns = record.returns ?? [];
  const returnedQuantity = returns.reduce((acc, item) => {
    if (item.status === $Enums.ReturnStatus.completed) {
      return acc + item.quantity;
    }
    return acc;
  }, 0);
  const returnableQuantity = Math.max(0, record.quantity - returnedQuantity);

  return {
    id: record.id,
    productId: record.productId,
    productCode: record.product.code,
    productName: record.product.name,
    productUnit: record.product.unit,
    quantity: record.quantity,
    dateOut: record.dateOut,
    status: record.status,
    ordererName: record.ordererName ?? undefined,
    recipientName: record.recipientName ?? undefined,
    recipientPhone: record.recipientPhone ?? undefined,
    recipientAddress: record.recipientAddress ?? undefined,
    recipientPostalCode: record.recipientPostalCode ?? undefined,
    invoiceNumber: record.invoiceNumber ?? undefined,
    freightType: record.freightType ?? undefined,
    paymentCondition: record.paymentCondition ?? undefined,
    specialNote: record.specialNote ?? undefined,
    memo: record.memo ?? undefined,
    returnedQuantity,
    returnableQuantity,
    createdAt: record.createdAt,
  };
}
