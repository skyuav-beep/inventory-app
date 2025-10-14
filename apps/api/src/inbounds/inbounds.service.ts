import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustStockResult, ProductsService } from '../products/products.service';
import { CreateInboundDto } from './dto/create-inbound.dto';
import { InboundListQueryDto } from './dto/inbound-query.dto';
import { UpdateInboundDto } from './dto/update-inbound.dto';
import { InboundEntity, toInboundEntity } from './entities/inbound.entity';
import { AlertsService } from '../alerts/alerts.service';
import { shouldTriggerLowStockAlert } from '../alerts/utils/low-stock.util';
import { ProductEntity } from '../products/entities/product.entity';

@Injectable()
export class InboundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
    private readonly alertsService: AlertsService,
  ) {}

  async findAll(query: InboundListQueryDto): Promise<{ data: InboundEntity[]; total: number }> {
    const page = query.page ?? 1;
    const size = query.size ?? 20;
    const skip = (page - 1) * size;

    const where: Prisma.InboundWhereInput = {};

    if (query.productId) {
      where.productId = query.productId;
    }

    const [records, total] = await this.prisma.$transaction([
      this.prisma.inbound.findMany({
        where,
        skip,
        take: size,
        orderBy: { dateIn: 'desc' },
        include: { product: true },
      }),
      this.prisma.inbound.count({ where }),
    ]);

    return {
      data: records.map(toInboundEntity),
      total,
    };
  }

  async create(payload: CreateInboundDto): Promise<InboundEntity> {
    const dateIn = payload.dateIn ?? new Date();

    const lowStockCandidates = new Map<string, ProductEntity>();

    const result = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: payload.productId } });

      if (!product) {
        throw new NotFoundException('제품을 찾을 수 없습니다.');
      }

      const inbound = await tx.inbound.create({
        data: {
          productId: payload.productId,
          quantity: payload.quantity,
          dateIn,
          note: payload.note,
        },
      });

      const adjustResult = await this.productsService.adjustStock(
        payload.productId,
        {
          inboundDelta: payload.quantity,
        },
        tx,
      );
      this.collectLowStockCandidate(lowStockCandidates, adjustResult);

      return toInboundEntity({ ...inbound, product });
    });

    await this.dispatchLowStockAlerts(lowStockCandidates);

    return result;
  }

  async findOne(id: string): Promise<InboundEntity> {
    const inbound = await this.prisma.inbound.findUnique({
      where: { id },
      include: { product: true },
    });

    if (!inbound) {
      throw new NotFoundException('입고 내역을 찾을 수 없습니다.');
    }

    return toInboundEntity(inbound);
  }

  async update(id: string, payload: UpdateInboundDto): Promise<InboundEntity> {
    const lowStockCandidates = new Map<string, ProductEntity>();

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.inbound.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new NotFoundException('입고 내역을 찾을 수 없습니다.');
      }

      const nextProductId = payload.productId ?? existing.productId;
      const nextQuantity = payload.quantity ?? existing.quantity;
      const nextDate = payload.dateIn ?? existing.dateIn;
      const nextNote = payload.note ?? existing.note;

      if (nextProductId !== existing.productId) {
        const product = await tx.product.findUnique({ where: { id: nextProductId } });
        if (!product) {
          throw new NotFoundException('제품을 찾을 수 없습니다.');
        }
      }

      const updated = await tx.inbound.update({
        where: { id },
        data: {
          productId: nextProductId,
          quantity: nextQuantity,
          dateIn: nextDate,
          note: nextNote,
        },
        include: { product: true },
      });

      if (existing.productId === nextProductId) {
        const delta = nextQuantity - existing.quantity;
        if (delta !== 0) {
          const adjustResult = await this.productsService.adjustStock(
            nextProductId,
            {
              inboundDelta: delta,
            },
            tx,
          );
          this.collectLowStockCandidate(lowStockCandidates, adjustResult);
        }
      } else {
        const revertResult = await this.productsService.adjustStock(
          existing.productId,
          {
            inboundDelta: -existing.quantity,
          },
          tx,
        );
        this.collectLowStockCandidate(lowStockCandidates, revertResult);

        const applyResult = await this.productsService.adjustStock(
          nextProductId,
          {
            inboundDelta: nextQuantity,
          },
          tx,
        );
        this.collectLowStockCandidate(lowStockCandidates, applyResult);
      }

      return toInboundEntity(updated);
    });

    await this.dispatchLowStockAlerts(lowStockCandidates);

    return result;
  }

  async remove(id: string): Promise<void> {
    const lowStockCandidates = new Map<string, ProductEntity>();

    await this.prisma.$transaction(async (tx) => {
      const inbound = await tx.inbound.findUnique({ where: { id } });

      if (!inbound) {
        throw new NotFoundException('입고 내역을 찾을 수 없습니다.');
      }

      await tx.inbound.delete({ where: { id } });

      const adjustResult = await this.productsService.adjustStock(
        inbound.productId,
        {
          inboundDelta: -inbound.quantity,
        },
        tx,
      );
      this.collectLowStockCandidate(lowStockCandidates, adjustResult);
    });

    await this.dispatchLowStockAlerts(lowStockCandidates);
  }

  private collectLowStockCandidate(store: Map<string, ProductEntity>, result: AdjustStockResult): void {
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
}
