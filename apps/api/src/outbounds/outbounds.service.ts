import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { CreateOutboundDto } from './dto/create-outbound.dto';
import { OutboundListQueryDto } from './dto/outbound-query.dto';
import { UpdateOutboundDto } from './dto/update-outbound.dto';
import { OutboundEntity, toOutboundEntity } from './entities/outbound.entity';

@Injectable()
export class OutboundsService {
  constructor(private readonly prisma: PrismaService, private readonly productsService: ProductsService) {}

  async findAll(query: OutboundListQueryDto): Promise<{ data: OutboundEntity[]; total: number }> {
    const page = query.page ?? 1;
    const size = query.size ?? 20;
    const skip = (page - 1) * size;

    const where: Prisma.OutboundWhereInput = {};

    if (query.productId) {
      where.productId = query.productId;
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

  async create(payload: CreateOutboundDto): Promise<OutboundEntity> {
    const dateOut = payload.dateOut ?? new Date();

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: payload.productId } });

      if (!product) {
        throw new NotFoundException('제품을 찾을 수 없습니다.');
      }

      if (product.remain < payload.quantity) {
        throw new BadRequestException('출고 수량이 재고보다 많습니다.');
      }

      const outbound = await tx.outbound.create({
        data: {
          productId: payload.productId,
          quantity: payload.quantity,
          dateOut,
          note: payload.note,
        },
      });

      await this.productsService.adjustStock(
        payload.productId,
        {
          outboundDelta: payload.quantity,
        },
        tx,
      );

      return toOutboundEntity({ ...outbound, product });
    });
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

  async update(id: string, payload: UpdateOutboundDto): Promise<OutboundEntity> {
    return this.prisma.$transaction(async (tx) => {
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
      const nextNote = payload.note ?? existing.note;

      let targetProduct = existing.product;

      if (nextProductId !== existing.productId) {
        targetProduct = await tx.product.findUnique({ where: { id: nextProductId } });

        if (!targetProduct) {
          throw new NotFoundException('제품을 찾을 수 없습니다.');
        }

        if (targetProduct.remain < nextQuantity) {
          throw new BadRequestException('출고 수량이 재고보다 많습니다.');
        }
      } else {
        const diff = nextQuantity - existing.quantity;
        if (diff > 0 && targetProduct.remain < diff) {
          throw new BadRequestException('출고 수량이 재고보다 많습니다.');
        }
      }

      const updated = await tx.outbound.update({
        where: { id },
        data: {
          productId: nextProductId,
          quantity: nextQuantity,
          dateOut: nextDateOut,
          note: nextNote,
        },
        include: { product: true },
      });

      if (existing.productId === nextProductId) {
        const diff = nextQuantity - existing.quantity;
        if (diff !== 0) {
          await this.productsService.adjustStock(
            nextProductId,
            {
              outboundDelta: diff,
            },
            tx,
          );
        }
      } else {
        await this.productsService.adjustStock(
          existing.productId,
          {
            outboundDelta: -existing.quantity,
          },
          tx,
        );

        await this.productsService.adjustStock(
          nextProductId,
          {
            outboundDelta: nextQuantity,
          },
          tx,
        );
      }

      return toOutboundEntity(updated);
    });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const outbound = await tx.outbound.findUnique({ where: { id } });

      if (!outbound) {
        throw new NotFoundException('출고 내역을 찾을 수 없습니다.');
      }

      await tx.outbound.delete({ where: { id } });

      await this.productsService.adjustStock(
        outbound.productId,
        {
          outboundDelta: -outbound.quantity,
        },
        tx,
      );
    });
  }
}
