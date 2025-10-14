import { Injectable, Logger } from '@nestjs/common';
import { UploadStatus, UploadType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InboundsService } from '../../inbounds/inbounds.service';
import { OutboundsService } from '../../outbounds/outbounds.service';
import { ProductsService } from '../../products/products.service';
import { parseStockUpload } from '../utils/parse-stock-upload';
import * as path from 'path';

@Injectable()
export class UploadQueueService {
  private readonly logger = new Logger(UploadQueueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
    private readonly inboundsService: InboundsService,
    private readonly outboundsService: OutboundsService,
  ) {}

  enqueue(jobId: string): void {
    this.logger.debug(`Queue enqueue requested for job ${jobId}`);

    setImmediate(() => {
      this.process(jobId).catch((error: unknown) => {
        const reason = error instanceof Error ? error.message : '업로드 처리 중 오류가 발생했습니다.';
        this.logger.error(`Queue processing failed for job ${jobId}: ${reason}`);
      });
    });
  }

  async process(jobId: string): Promise<void> {
    await this.prisma.uploadJob.update({
      where: { id: jobId },
      data: { status: UploadStatus.processing },
    });

    try {
      const job = await this.prisma.uploadJob.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        throw new Error('업로드 작업을 찾을 수 없습니다.');
      }

      const filePath = this.resolveFilePath(job.filename);
      const parsed = await parseStockUpload(filePath);

      await this.persistItems(job.id, job.type, parsed);

      await this.prisma.uploadJob.update({
        where: { id: jobId },
        data: { status: UploadStatus.completed, finishedAt: new Date(), lastError: null },
      });
    } catch (rawError) {
      const reason = rawError instanceof Error ? rawError.message : '알 수 없는 오류가 발생했습니다.';

      this.logger.error(`Upload job ${jobId} failed: ${reason}`);

      await this.prisma.uploadJob.update({
        where: { id: jobId },
        data: { status: UploadStatus.failed, finishedAt: new Date(), lastError: reason },
      });
    }
  }

  private resolveFilePath(filename: string): string {
    return path.join(process.cwd(), 'storage', 'uploads', filename);
  }

  private async persistItems(
    jobId: string,
    type: UploadType,
    rows: Array<{ code: string; quantity: number; date: Date; note?: string }>,
  ): Promise<void> {
    await this.prisma.uploadJobItem.deleteMany({ where: { jobId } });

    for (const [index, row] of rows.entries()) {
      const item = await this.prisma.uploadJobItem.create({
        data: {
          jobId,
          rowNo: index + 1,
          payloadJson: row,
          status: UploadStatus.processing,
        },
      });

      const product = await this.productsService.findByCode(row.code);

      if (!product) {
        await this.prisma.uploadJobItem.update({
          where: { id: item.id },
          data: { status: UploadStatus.failed, errorMsg: '제품 코드를 찾을 수 없습니다.' },
        });
        continue;
      }

      try {
        if (type === UploadType.inbound) {
          await this.inboundsService.create({
            productId: product.id,
            quantity: row.quantity,
            dateIn: row.date,
            note: row.note,
          });
        } else {
          await this.outboundsService.create({
            productId: product.id,
            quantity: row.quantity,
            dateOut: row.date,
            note: row.note,
          });
        }

        await this.prisma.uploadJobItem.update({
          where: { id: item.id },
          data: { status: UploadStatus.completed, errorMsg: null },
        });
      } catch (operationError) {
        const message = operationError instanceof Error ? operationError.message : '레코드 저장 중 오류가 발생했습니다.';
        await this.prisma.uploadJobItem.update({
          where: { id: item.id },
          data: { status: UploadStatus.failed, errorMsg: message },
        });
      }
    }
  }
}
