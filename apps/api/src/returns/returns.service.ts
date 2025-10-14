import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReturnStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustStockResult, ProductsService } from '../products/products.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { ReturnListQueryDto } from './dto/return-query.dto';
import { UpdateReturnStatusDto } from './dto/update-return-status.dto';
import { UpdateReturnDto } from './dto/update-return.dto';
import { ReturnEntity, toReturnEntity } from './entities/return.entity';
import { AlertsService } from '../alerts/alerts.service';
import { shouldTriggerLowStockAlert } from '../alerts/utils/low-stock.util';
import { ProductEntity } from '../products/entities/product.entity';

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
    private readonly alertsService: AlertsService,
  ) {}

  async findAll(query: ReturnListQueryDto): Promise<{ data: ReturnEntity[]; total: number }> {
    const page = query.page ?? 1;
    const size = query.size ?? 20;
    const skip = (page - 1) * size;

    const where: Prisma.ReturnRecordWhereInput = {};

    if (query.productId) {
      where.productId = query.productId;
    }

    if (query.status) {
      where.status = query.status;
    }

    const [records, total] = await this.prisma.$transaction([
      this.prisma.returnRecord.findMany({
        where,
        skip,
        take: size,
        orderBy: { dateReturn: 'desc' },
        include: { product: true },
      }),
      this.prisma.returnRecord.count({ where }),
    ]);

    return {
      data: records.map(toReturnEntity),
      total,
    };
  }

  async create(payload: CreateReturnDto): Promise<ReturnEntity> {
    const dateReturn = payload.dateReturn ?? new Date();
    const status = payload.status ?? ReturnStatus.pending;

    const lowStockCandidates = new Map<string, ProductEntity>();

    const result = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: payload.productId } });

      if (!product) {
        throw new NotFoundException('제품을 찾을 수 없습니다.');
      }

      const record = await tx.returnRecord.create({
        data: {
          productId: payload.productId,
          quantity: payload.quantity,
          reason: payload.reason,
          status,
          dateReturn,
        },
      });

      if (status === ReturnStatus.completed) {
        const adjustResult = await this.productsService.adjustStock(
          payload.productId,
          {
            returnDelta: payload.quantity,
          },
          tx,
        );
        this.collectLowStockCandidate(lowStockCandidates, adjustResult);
      }

      return toReturnEntity({ ...record, product });
    });

    await this.dispatchLowStockAlerts(lowStockCandidates);

    return result;
  }

  async findOne(id: string): Promise<ReturnEntity> {
    const record = await this.prisma.returnRecord.findUnique({
      where: { id },
      include: { product: true },
    });

    if (!record) {
      throw new NotFoundException('반품 내역을 찾을 수 없습니다.');
    }

    return toReturnEntity(record);
  }

  async update(id: string, payload: UpdateReturnDto): Promise<ReturnEntity> {
    const lowStockCandidates = new Map<string, ProductEntity>();

    const result = await this.prisma.$transaction(async (tx) => {
      const record = await tx.returnRecord.findUnique({
        where: { id },
        include: { product: true },
      });

      if (!record) {
        throw new NotFoundException('반품 내역을 찾을 수 없습니다.');
      }

      const nextProductId = payload.productId ?? record.productId;
      const nextQuantity = payload.quantity ?? record.quantity;
      const nextReason = payload.reason ?? record.reason;
      const nextStatus = payload.status ?? record.status;
      const nextDateReturn = payload.dateReturn ?? record.dateReturn;

      if (nextProductId !== record.productId) {
        const product = await tx.product.findUnique({ where: { id: nextProductId } });
        if (!product) {
          throw new NotFoundException('제품을 찾을 수 없습니다.');
        }
      }

      const updated = await tx.returnRecord.update({
        where: { id },
        data: {
          productId: nextProductId,
          quantity: nextQuantity,
          reason: nextReason,
          status: nextStatus,
          dateReturn: nextDateReturn,
        },
        include: { product: true },
      });

      const previousEffective = record.status === ReturnStatus.completed ? record.quantity : 0;
      const nextEffective = nextStatus === ReturnStatus.completed ? nextQuantity : 0;

      if (record.productId === nextProductId) {
        const delta = nextEffective - previousEffective;
        if (delta !== 0) {
          const adjustResult = await this.productsService.adjustStock(
            nextProductId,
            {
              returnDelta: delta,
            },
            tx,
          );
          this.collectLowStockCandidate(lowStockCandidates, adjustResult);
        }
      } else {
        if (previousEffective !== 0) {
          const revertResult = await this.productsService.adjustStock(
            record.productId,
            {
              returnDelta: -previousEffective,
            },
            tx,
          );
          this.collectLowStockCandidate(lowStockCandidates, revertResult);
        }

        if (nextEffective !== 0) {
          const applyResult = await this.productsService.adjustStock(
            nextProductId,
            {
              returnDelta: nextEffective,
            },
            tx,
          );
          this.collectLowStockCandidate(lowStockCandidates, applyResult);
        }
      }

      return toReturnEntity(updated);
    });

    await this.dispatchLowStockAlerts(lowStockCandidates);

    return result;
  }

  async updateStatus(id: string, payload: UpdateReturnStatusDto): Promise<ReturnEntity> {
    return this.update(id, payload);
  }

  async remove(id: string): Promise<void> {
    const lowStockCandidates = new Map<string, ProductEntity>();

    await this.prisma.$transaction(async (tx) => {
      const record = await tx.returnRecord.findUnique({ where: { id } });

      if (!record) {
        throw new NotFoundException('반품 내역을 찾을 수 없습니다.');
      }

      await tx.returnRecord.delete({ where: { id } });

      if (record.status === ReturnStatus.completed) {
        const adjustResult = await this.productsService.adjustStock(
          record.productId,
          {
            returnDelta: -record.quantity,
          },
          tx,
        );
        this.collectLowStockCandidate(lowStockCandidates, adjustResult);
      }
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
