import { ProductStatus } from '@prisma/client';
import { ProductEntity } from '../../products/entities/product.entity';

export function buildLowStockAlertMessage(
  product: Pick<ProductEntity, 'name' | 'code' | 'remain' | 'safetyStock'>,
): string {
  const timestamp = new Date().toISOString();
  const remainText = `${product.remain.toLocaleString()}개`;
  const safetyText = `${product.safetyStock.toLocaleString()}개`;

  return [
    '⚠️ 재고 부족 경고',
    `제품: ${product.name} (${product.code})`,
    `남은 재고: ${remainText}`,
    `필요 안전재고: ${safetyText}`,
    `점검 시각: ${timestamp}`,
  ].join('\n');
}

export function shouldTriggerLowStockAlert(
  previousStatus: ProductStatus,
  nextStatus: ProductStatus,
): boolean {
  return previousStatus !== ProductStatus.low && nextStatus === ProductStatus.low;
}
