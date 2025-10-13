import { Injectable, Logger } from '@nestjs/common';
import { UploadStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UploadQueueService {
  private readonly logger = new Logger(UploadQueueService.name);

  constructor(private readonly prisma: PrismaService) {}

  async enqueue(jobId: string): Promise<void> {
    this.logger.debug(`Queue enqueue requested for job ${jobId}`);

    // TODO: 실제 워커 인프라 연동 시 메시지 큐 publish 로 교체
    await this.prisma.uploadJob.update({
      where: { id: jobId },
      data: { status: UploadStatus.processing },
    });
  }

  async markCompleted(jobId: string): Promise<void> {
    await this.prisma.uploadJob.update({
      where: { id: jobId },
      data: { status: UploadStatus.completed, finishedAt: new Date() },
    });
  }

  async markFailed(jobId: string, reason?: string): Promise<void> {
    await this.prisma.uploadJob.update({
      where: { id: jobId },
      data: {
        status: UploadStatus.failed,
        finishedAt: new Date(),
        lastError: reason ?? null,
      },
    });
  }
}

