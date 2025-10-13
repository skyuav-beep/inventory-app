import { Injectable } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toProductEntity } from '../products/entities/product.entity';
import { composeDashboardTotals } from './utils/dashboard-totals.util';

@Injectable()
export class DashboardService {
  private readonly lowStockLimit = 10;

  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const [totalProducts, aggregates, lowStockProducts] = await this.prisma.$transaction([
      this.prisma.product.count(),
      this.prisma.product.aggregate({
        _sum: {
          totalIn: true,
          totalOut: true,
          totalReturn: true,
        },
      }),
      this.prisma.product.findMany({
        where: { status: ProductStatus.low },
        orderBy: { remain: 'asc' },
        take: this.lowStockLimit,
      }),
    ]);

    const totals = composeDashboardTotals(totalProducts, {
      totalIn: aggregates._sum.totalIn,
      totalOut: aggregates._sum.totalOut,
      totalReturn: aggregates._sum.totalReturn,
    });

    return {
      totals,
      lowStock: lowStockProducts.map(toProductEntity),
    };
  }
}
