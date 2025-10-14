import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Product, ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductListQueryDto } from './dto/product-query.dto';
import { ProductEntity, toProductEntity } from './entities/product.entity';
import { calculateRemain, resolveProductStatus } from './utils/product-stock.util';
import { AlertsService } from '../alerts/alerts.service';
import { shouldTriggerLowStockAlert } from '../alerts/utils/low-stock.util';

export interface AdjustStockResult {
  product: ProductEntity;
  previousStatus: ProductStatus;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService, private readonly alertsService: AlertsService) {}

  async create(payload: CreateProductDto): Promise<ProductEntity> {
    try {
      const product = await this.prisma.product.create({
        data: {
          code: payload.code,
          name: payload.name,
          description: payload.description,
          safetyStock: payload.safetyStock ?? 0,
        },
      });

      const recalculated = await this.recalculateStock(product.id);

      return toProductEntity(recalculated);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('이미 존재하는 제품 코드입니다.');
      }

      throw error;
    }
  }

  async findAll(query: ProductListQueryDto): Promise<{ data: ProductEntity[]; total: number }> {
    const page = query.page ?? 1;
    const size = query.size ?? 20;
    const skip = (page - 1) * size;

    const where: Prisma.ProductWhereInput = {};

    if (query.search) {
      const search = query.search.trim();
      if (search.length > 0) {
        where.OR = [
          { code: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ];
      }
    }

    if (query.status) {
      where.status = query.status;
    }

    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        skip,
        take: size,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products.map(toProductEntity),
      total,
    };
  }

  async findOne(id: string): Promise<ProductEntity> {
    const product = await this.prisma.product.findUnique({ where: { id } });

    if (!product) {
      throw new NotFoundException('제품을 찾을 수 없습니다.');
    }

    return toProductEntity(product);
  }

  async findByCode(code: string): Promise<ProductEntity | null> {
    const product = await this.prisma.product.findUnique({ where: { code } });
    return product ? toProductEntity(product) : null;
  }

  async update(id: string, payload: UpdateProductDto): Promise<ProductEntity> {
    const existing = await this.prisma.product.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException('제품을 찾을 수 없습니다.');
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        name: payload.name,
        description: payload.description,
        safetyStock: payload.safetyStock,
      },
    });

    const recalculated = await this.recalculateStock(product.id);
    const entity = toProductEntity(recalculated);

    if (shouldTriggerLowStockAlert(existing.status, entity.status)) {
      await this.alertsService.notifyLowStock(entity);
    }

    return entity;
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.product.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException('제품을 찾을 수 없습니다.');
    }

    await this.prisma.product.delete({ where: { id } });
  }

  async adjustStock(
    productId: string,
    deltas: { inboundDelta?: number; outboundDelta?: number; returnDelta?: number },
    tx?: Prisma.TransactionClient,
  ): Promise<AdjustStockResult> {
    const client = tx ?? this.prisma;
    const product = await client.product.findUnique({ where: { id: productId } });

    if (!product) {
      throw new NotFoundException('제품을 찾을 수 없습니다.');
    }

    const inboundDelta = deltas.inboundDelta ?? 0;
    const outboundDelta = deltas.outboundDelta ?? 0;
    const returnDelta = deltas.returnDelta ?? 0;

    const nextTotals = {
      totalIn: product.totalIn + inboundDelta,
      totalOut: product.totalOut + outboundDelta,
      totalReturn: product.totalReturn + returnDelta,
    };

    const remain = calculateRemain(nextTotals.totalIn, nextTotals.totalOut, nextTotals.totalReturn);
    const status = resolveProductStatus(remain, product.safetyStock);

    const updated = await client.product.update({
      where: { id: productId },
      data: {
        totalIn: nextTotals.totalIn,
        totalOut: nextTotals.totalOut,
        totalReturn: nextTotals.totalReturn,
        remain,
        status,
      },
    });

    return {
      product: toProductEntity(updated),
      previousStatus: product.status,
    };
  }

  async recalculateStock(productId: string, tx?: Prisma.TransactionClient): Promise<Product> {
    const client = tx ?? this.prisma;
    const product = await client.product.findUnique({ where: { id: productId } });

    if (!product) {
      throw new NotFoundException('제품을 찾을 수 없습니다.');
    }

    const remain = calculateRemain(product.totalIn, product.totalOut, product.totalReturn);
    const status = resolveProductStatus(remain, product.safetyStock);

    return client.product.update({
      where: { id: productId },
      data: {
        remain,
        status,
      },
    });
  }
}
