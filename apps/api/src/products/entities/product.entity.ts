import { Product, ProductStatus } from '@prisma/client';

export interface ProductEntity {
  id: string;
  code: string;
  name: string;
  description?: string;
  safetyStock: number;
  totalIn: number;
  totalOut: number;
  totalReturn: number;
  remain: number;
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
}

export function toProductEntity(product: Product): ProductEntity {
  return {
    id: product.id,
    code: product.code,
    name: product.name,
    description: product.description ?? undefined,
    safetyStock: product.safetyStock,
    totalIn: product.totalIn,
    totalOut: product.totalOut,
    totalReturn: product.totalReturn,
    remain: product.remain,
    status: product.status,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}
