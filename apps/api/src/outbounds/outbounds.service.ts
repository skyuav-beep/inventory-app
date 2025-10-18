import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { $Enums, AuditAction, Prisma, Resource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustStockResult, ProductsService } from '../products/products.service';
import { CreateOutboundDto } from './dto/create-outbound.dto';
import { OutboundListQueryDto } from './dto/outbound-query.dto';
import { UpdateOutboundDto } from './dto/update-outbound.dto';
import { OutboundEntity, toOutboundEntity } from './entities/outbound.entity';
import { AlertsService } from '../alerts/alerts.service';
import { shouldTriggerLowStockAlert } from '../alerts/utils/low-stock.util';
import { ProductEntity } from '../products/entities/product.entity';
import { AuditService } from '../audit/audit.service';
import { ActiveUserData } from '../auth/types/active-user-data';

interface AuditContext {
  actor?: ActiveUserData | null;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class OutboundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
    private readonly alertsService: AlertsService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(query: OutboundListQueryDto): Promise<{ data: OutboundEntity[]; total: number }> {
    const page = query.page ?? 1;
    const size = query.size ?? 20;
    const skip = (page - 1) * size;

    const where: Prisma.OutboundWhereInput = {};

    if (query.productId) {
      where.productId = query.productId;
    }

    if (query.status) {
      where.status = query.status;
    }

    const [records, total] = await this.prisma.$transaction([
      this.prisma.outbound.findMany({
        where,
        skip,
        take: size,
        orderBy: { dateOut: 'desc' },
        include: { product: true },
      }),
      this.prisma.outbound.count({ where }),
    ]);

    return {
      data: records.map(toOutboundEntity),
      total,
    };
  }

  async create(payload: CreateOutboundDto, context?: AuditContext): Promise<OutboundEntity> {
    const dateOut = payload.dateOut ?? new Date();

    const lowStockCandidates = new Map<string, ProductEntity>();

    const result = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: payload.productId } });

      if (!product) {
        throw new NotFoundException('제품을 찾을 수 없습니다.');
      }

      if (product.remain < payload.quantity) {
        throw new BadRequestException('출고 수량이 재고보다 많습니다.');
      }

      if (product.disabled) {
        throw new BadRequestException('사용 중지된 제품은 출고할 수 없습니다.');
      }

      const outbound = await tx.outbound.create({
        data: {
          productId: payload.productId,
          quantity: payload.quantity,
          dateOut,
          status: payload.status ?? $Enums.OutboundStatus.shipped,
          note: this.sanitizeNullableString(payload.note),
          orderDate: payload.orderDate ?? null,
          ordererId: this.sanitizeNullableString(payload.ordererId),
          ordererName: this.sanitizeNullableString(payload.ordererName),
          recipientName: this.sanitizeNullableString(payload.recipientName),
          recipientPhone: this.sanitizeNullableString(payload.recipientPhone),
          recipientAddress: this.sanitizeNullableString(payload.recipientAddress),
          recipientPostalCode: this.sanitizeNullableString(payload.recipientPostalCode),
          customsNumber: this.sanitizeNullableString(payload.customsNumber),
          invoiceNumber: this.sanitizeNullableString(payload.invoiceNumber),
        },
      });

      const adjustResult = await this.productsService.adjustStock(
        payload.productId,
        {
          outboundDelta: payload.quantity,
        },
        tx,
      );
      this.collectLowStockCandidate(lowStockCandidates, adjustResult);

      return toOutboundEntity({ ...outbound, product });
    });

    await this.dispatchLowStockAlerts(lowStockCandidates);

    await this.auditService.record({
      userId: context?.actor?.userId,
      resource: Resource.outbounds,
      action: AuditAction.create,
      entityId: result.id,
      payload: this.toJsonValue(payload),
      ipAddress: context?.ip,
      userAgent: context?.userAgent,
    });

    return result;
  }

  async findOne(id: string): Promise<OutboundEntity> {
    const outbound = await this.prisma.outbound.findUnique({
      where: { id },
      include: { product: true },
    });

    if (!outbound) {
      throw new NotFoundException('출고 내역을 찾을 수 없습니다.');
    }

    return toOutboundEntity(outbound);
  }

  async update(
    id: string,
    payload: UpdateOutboundDto,
    context?: AuditContext,
  ): Promise<OutboundEntity> {
    const lowStockCandidates = new Map<string, ProductEntity>();

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.outbound.findUnique({
        where: { id },
        include: { product: true },
      });

      if (!existing) {
        throw new NotFoundException('출고 내역을 찾을 수 없습니다.');
      }

      const nextProductId = payload.productId ?? existing.productId;
      const nextQuantity = payload.quantity ?? existing.quantity;
      const nextDateOut = payload.dateOut ?? existing.dateOut;

      let targetProduct = existing.product;

      if (nextProductId !== existing.productId) {
        const swappedProduct = await tx.product.findUnique({ where: { id: nextProductId } });

        if (!swappedProduct) {
          throw new NotFoundException('제품을 찾을 수 없습니다.');
        }

        targetProduct = swappedProduct;

        if (swappedProduct.remain < nextQuantity) {
          throw new BadRequestException('출고 수량이 재고보다 많습니다.');
        }

        if (swappedProduct.disabled) {
          throw new BadRequestException('사용 중지된 제품은 출고할 수 없습니다.');
        }
      } else {
        const diff = nextQuantity - existing.quantity;
        if (diff > 0 && targetProduct.remain < diff) {
          throw new BadRequestException('출고 수량이 재고보다 많습니다.');
        }

        if (targetProduct.disabled) {
          throw new BadRequestException('사용 중지된 제품은 출고할 수 없습니다.');
        }
      }

      const updated = await tx.outbound.update({
        where: { id },
        data: {
          productId: nextProductId,
          quantity: nextQuantity,
          dateOut: nextDateOut,
          status: payload.status !== undefined ? payload.status : undefined,
          note: payload.note !== undefined ? this.sanitizeNullableString(payload.note) : undefined,
          orderDate: payload.orderDate !== undefined ? (payload.orderDate ?? null) : undefined,
          ordererId:
            payload.ordererId !== undefined
              ? this.sanitizeNullableString(payload.ordererId)
              : undefined,
          ordererName:
            payload.ordererName !== undefined
              ? this.sanitizeNullableString(payload.ordererName)
              : undefined,
          recipientName:
            payload.recipientName !== undefined
              ? this.sanitizeNullableString(payload.recipientName)
              : undefined,
          recipientPhone:
            payload.recipientPhone !== undefined
              ? this.sanitizeNullableString(payload.recipientPhone)
              : undefined,
          recipientAddress:
            payload.recipientAddress !== undefined
              ? this.sanitizeNullableString(payload.recipientAddress)
              : undefined,
          recipientPostalCode:
            payload.recipientPostalCode !== undefined
              ? this.sanitizeNullableString(payload.recipientPostalCode)
              : undefined,
          customsNumber:
            payload.customsNumber !== undefined
              ? this.sanitizeNullableString(payload.customsNumber)
              : undefined,
          invoiceNumber:
            payload.invoiceNumber !== undefined
              ? this.sanitizeNullableString(payload.invoiceNumber)
              : undefined,
        },
        include: { product: true },
      });

      if (existing.productId === nextProductId) {
        const diff = nextQuantity - existing.quantity;
        if (diff !== 0) {
          const adjustResult = await this.productsService.adjustStock(
            nextProductId,
            {
              outboundDelta: diff,
            },
            tx,
          );
          this.collectLowStockCandidate(lowStockCandidates, adjustResult);
        }
      } else {
        const revertResult = await this.productsService.adjustStock(
          existing.productId,
          {
            outboundDelta: -existing.quantity,
          },
          tx,
        );
        this.collectLowStockCandidate(lowStockCandidates, revertResult);

        const applyResult = await this.productsService.adjustStock(
          nextProductId,
          {
            outboundDelta: nextQuantity,
          },
          tx,
        );
        this.collectLowStockCandidate(lowStockCandidates, applyResult);
      }

      return toOutboundEntity(updated);
    });

    await this.dispatchLowStockAlerts(lowStockCandidates);

    await this.auditService.record({
      userId: context?.actor?.userId,
      resource: Resource.outbounds,
      action: AuditAction.update,
      entityId: result.id,
      payload: this.toJsonValue(payload),
      ipAddress: context?.ip,
      userAgent: context?.userAgent,
    });

    return result;
  }

  async remove(id: string, context?: AuditContext): Promise<void> {
    const lowStockCandidates = new Map<string, ProductEntity>();

    await this.prisma.$transaction(async (tx) => {
      const outbound = await tx.outbound.findUnique({ where: { id } });

      if (!outbound) {
        throw new NotFoundException('출고 내역을 찾을 수 없습니다.');
      }

      await tx.outbound.delete({ where: { id } });

      const adjustResult = await this.productsService.adjustStock(
        outbound.productId,
        {
          outboundDelta: -outbound.quantity,
        },
        tx,
      );
      this.collectLowStockCandidate(lowStockCandidates, adjustResult);

      await this.auditService.record({
        userId: context?.actor?.userId,
        resource: Resource.outbounds,
        action: AuditAction.delete,
        entityId: outbound.id,
        payload: this.toJsonValue(outbound),
        ipAddress: context?.ip,
        userAgent: context?.userAgent,
      });
    });

    await this.dispatchLowStockAlerts(lowStockCandidates);
  }

  private collectLowStockCandidate(
    store: Map<string, ProductEntity>,
    result: AdjustStockResult,
  ): void {
    if (shouldTriggerLowStockAlert(result.previousStatus, result.product.status)) {
      store.set(result.product.id, result.product);
    }
  }

  private async dispatchLowStockAlerts(store: Map<string, ProductEntity>): Promise<void> {
    if (store.size === 0) {
      return;
    }

    for (const product of store.values()) {
      await this.alertsService.notifyLowStock(product);
    }
  }

  private sanitizeNullableString(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
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
