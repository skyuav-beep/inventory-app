import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma, Product, ProductStatus, Resource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductListQueryDto } from './dto/product-query.dto';
import { ProductEntity, toProductEntity } from './entities/product.entity';
import { calculateRemain, resolveProductStatus } from './utils/product-stock.util';
import { AlertsService } from '../alerts/alerts.service';
import { shouldTriggerLowStockAlert } from '../alerts/utils/low-stock.util';
import { AuditService } from '../audit/audit.service';
import { ActiveUserData } from '../auth/types/active-user-data';

interface AuditContext {
  actor?: ActiveUserData | null;
  ip?: string;
  userAgent?: string;
}

export interface AdjustStockResult {
  product: ProductEntity;
  previousStatus: ProductStatus;
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alertsService: AlertsService,
    private readonly auditService: AuditService,
  ) {}

  async create(payload: CreateProductDto, context?: AuditContext): Promise<ProductEntity> {
    try {
      const product = await this.prisma.product.create({
        data: {
          code: payload.code,
          name: payload.name,
          description: payload.description,
          specification: payload.specification,
          unit: payload.unit ?? 'EA',
          safetyStock: payload.safetyStock ?? 0,
          disabled: payload.disabled ?? false,
        },
      });

      const recalculated = await this.recalculateStock(product.id);

      const entity = toProductEntity(recalculated);

      await this.auditService.record({
        userId: context?.actor?.userId,
        resource: Resource.products,
        action: AuditAction.create,
        entityId: entity.id,
        payload: this.toJsonValue(payload),
        ipAddress: context?.ip,
        userAgent: context?.userAgent,
      });

      return entity;
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
          { specification: { contains: search, mode: 'insensitive' } },
        ];
      }
    }

    if (query.status) {
      where.status = query.status;
    }

    if (typeof query.disabled === 'boolean') {
      where.disabled = query.disabled;
    } else if (!query.includeDisabled) {
      where.disabled = false;
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

  async update(
    id: string,
    payload: UpdateProductDto,
    context?: AuditContext,
  ): Promise<ProductEntity> {
    const existing = await this.prisma.product.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException('제품을 찾을 수 없습니다.');
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        name: payload.name,
        description: payload.description,
        specification: payload.specification,
        unit: payload.unit,
        safetyStock: payload.safetyStock,
        disabled: payload.disabled,
      },
    });

    const recalculated = await this.recalculateStock(product.id);
    const entity = toProductEntity(recalculated);

    if (shouldTriggerLowStockAlert(existing.status, entity.status)) {
      await this.alertsService.notifyLowStock(entity);
    }

    await this.auditService.record({
      userId: context?.actor?.userId,
      resource: Resource.products,
      action: AuditAction.update,
      entityId: entity.id,
      payload: this.toJsonValue(payload),
      ipAddress: context?.ip,
      userAgent: context?.userAgent,
    });

    return entity;
  }

  async remove(id: string, context?: AuditContext): Promise<void> {
    const existing = await this.prisma.product.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException('제품을 찾을 수 없습니다.');
    }

    await this.prisma.product.delete({ where: { id } });

    await this.auditService.record({
      userId: context?.actor?.userId,
      resource: Resource.products,
      action: AuditAction.delete,
      entityId: existing.id,
      payload: this.toJsonValue(existing),
      ipAddress: context?.ip,
      userAgent: context?.userAgent,
    });
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

  private toJsonValue(value: unknown) {
    if (value === undefined || value === null) {
      return undefined;
    }

    try {
      return JSON.parse(JSON.stringify(value)) as Prisma.JsonValue;
    } catch {
      return undefined;
    }
  }
}
