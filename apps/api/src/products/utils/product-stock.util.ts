import { ProductStatus } from '@prisma/client';

const WARN_THRESHOLD_MULTIPLIER = 1.2;

export function calculateRemain(totalIn: number, totalOut: number, totalReturn: number): number {
  return totalIn - totalOut + totalReturn;
}

export function resolveProductStatus(remain: number, safetyStock: number): ProductStatus {
  if (remain <= 0) {
    return ProductStatus.low;
  }

  if (safetyStock <= 0) {
    return ProductStatus.normal;
  }

  if (remain < safetyStock) {
    return ProductStatus.low;
  }

  if (remain < Math.ceil(safetyStock * WARN_THRESHOLD_MULTIPLIER)) {
    return ProductStatus.warn;
  }

  return ProductStatus.normal;
}
