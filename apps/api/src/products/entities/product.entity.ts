import { Product, ProductStatus } from '@prisma/client';

export interface ProductEntity {
  id: string;
  code: string;
  name: string;
  description?: string;
  specification?: string;
  unit: string;
  safetyStock: number;
  totalIn: number;
  totalOut: number;
  totalReturn: number;
  remain: number;
  status: ProductStatus;
  disabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toProductEntity(product: Product): ProductEntity {
  return {
    id: product.id,
    code: product.code,
    name: product.name,
    description: product.description ?? undefined,
    specification: product.specification ?? undefined,
    unit: product.unit,
    safetyStock: product.safetyStock,
    totalIn: product.totalIn,
    totalOut: product.totalOut,
    totalReturn: product.totalReturn,
    remain: product.remain,
    status: product.status,
    disabled: product.disabled,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}
