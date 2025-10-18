import { Injectable } from '@nestjs/common';
import { Product, ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toProductEntity } from '../products/entities/product.entity';
import { composeDashboardTotals } from './utils/dashboard-totals.util';

@Injectable()
export class DashboardService {
  private readonly lowStockLimit = 10;

  constructor(private readonly prisma: PrismaService) {}

  private mapProductSnapshot(product: Product) {
    const entity = toProductEntity(product);

    return {
      id: entity.id,
      code: entity.code,
      name: entity.name,
      safetyStock: entity.safetyStock,
      remain: entity.remain,
      totalIn: entity.totalIn,
      totalOut: entity.totalOut,
      totalReturn: entity.totalReturn,
      status: entity.status,
    };
  }

  async getSummary() {
    const [totalProducts, aggregates, lowStockProducts, productSnapshot] = await this.prisma.$transaction([
      this.prisma.product.count({ where: { disabled: false } }),
      this.prisma.product.aggregate({
        where: { disabled: false },
        _sum: {
          totalIn: true,
          totalOut: true,
          totalReturn: true,
        },
      }),
      this.prisma.product.findMany({
        where: { status: ProductStatus.low, disabled: false },
        orderBy: { remain: 'asc' },
        take: this.lowStockLimit,
      }),
      this.prisma.product.findMany({
        where: { disabled: false },
        orderBy: { name: 'asc' },
      }),
    ]);

    const totals = composeDashboardTotals(totalProducts, {
      totalIn: aggregates._sum.totalIn,
      totalOut: aggregates._sum.totalOut,
      totalReturn: aggregates._sum.totalReturn,
    });

    return {
      totals,
      lowStock: lowStockProducts.map((product) => this.mapProductSnapshot(product)),
      stockByProduct: productSnapshot.map((product) => this.mapProductSnapshot(product)),
    };
  }
}
