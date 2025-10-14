import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UploadStatus } from '@prisma/client';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUploadDto } from './dto/create-upload.dto';
import { UploadJobsQueryDto } from './dto/upload-jobs-query.dto';
import {
  UploadJobEntity,
  UploadJobItemCounts,
  toUploadJobEntity,
} from './entities/upload-job.entity';
import { UploadJobItemEntity, toUploadJobItemEntity } from './entities/upload-job-item.entity';
import { UploadQueueService } from './worker/upload-queue.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@Injectable()
export class UploadsService {
  private readonly storageDir = path.join(process.cwd(), 'storage', 'uploads');

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: UploadQueueService,
  ) {}

  async createUploadJob(dto: CreateUploadDto & { createdById?: string | null; file: unknown }): Promise<UploadJobEntity> {
    const storedFile = await this.persistFile(dto.file);

    const job = await this.prisma.uploadJob.create({
      data: {
        type: dto.type,
        status: 'queued',
        createdById: dto.createdById ?? null,
        filename: storedFile.filename,
        originalName: storedFile.originalName,
      },
    });

    this.queueService.enqueue(job.id);

    return toUploadJobEntity(job);
  }

  async listJobs(query: UploadJobsQueryDto): Promise<{ data: UploadJobEntity[]; page: { page: number; size: number; total: number } }> {
    const page = query.page ?? 1;
    const size = query.size ?? 20;
    const skip = (page - 1) * size;

    const where: Prisma.UploadJobWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }

    const [jobs, total] = await this.prisma.$transaction([
      this.prisma.uploadJob.findMany({
        where,
        skip,
        take: size,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.uploadJob.count({ where }),
    ]);

    const jobIds = jobs.map((job) => job.id);
    const aggregates = jobIds.length
      ? await this.prisma.uploadJobItem.groupBy({
          by: ['jobId', 'status'],
          _count: { status: true },
          where: { jobId: { in: jobIds } },
        })
      : [];

    const aggregateMap = new Map<string, typeof aggregates>();
    for (const aggregate of aggregates) {
      const list = aggregateMap.get(aggregate.jobId) ?? [];
      list.push(aggregate);
      aggregateMap.set(aggregate.jobId, list);
    }

    const data = jobs.map((job) => {
      const entity = toUploadJobEntity(job);
      const stats = aggregateMap.get(job.id);
      if (stats && stats.length > 0) {
        entity.itemCounts = this.buildItemCounts(stats);
      }
      return entity;
    });

    return {
      data,
      page: {
        page,
        size,
        total,
      },
    };
  }

  private async persistFile(fileInput: unknown): Promise<{ filename: string; originalName: string }> {
    if (!fileInput || typeof fileInput !== 'object') {
      throw new BadRequestException('업로드 파일 정보를 확인할 수 없습니다.');
    }

    const candidate = fileInput as {
      originalname?: unknown;
      buffer?: unknown;
      path?: unknown;
    };

    if (typeof candidate.originalname !== 'string' || candidate.originalname.length === 0) {
      throw new BadRequestException('파일 이름이 올바르지 않습니다.');
    }

    const buffer = candidate.buffer instanceof Buffer ? candidate.buffer : undefined;
    const tempPath = typeof candidate.path === 'string' ? candidate.path : undefined;

    if (!buffer && !tempPath) {
      throw new BadRequestException('파일 데이터가 비어 있습니다.');
    }

    await fs.mkdir(this.storageDir, { recursive: true });

    const ext = path.extname(candidate.originalname);
    const filename = `${randomUUID()}${ext}`;
    const filePath = path.join(this.storageDir, filename);

    if (buffer) {
      await fs.writeFile(filePath, buffer);
    } else if (tempPath) {
      await fs.copyFile(tempPath, filePath);
      await fs.unlink(tempPath).catch(() => undefined);
    }

    return {
      filename,
      originalName: candidate.originalname,
    };
  }

  async getJob(jobId: string): Promise<UploadJobEntity> {
    const job = await this.prisma.uploadJob.findUnique({ where: { id: jobId } });

    if (!job) {
      throw new NotFoundException('업로드 작업을 찾을 수 없습니다.');
    }

    const aggregates = await this.prisma.uploadJobItem.groupBy({
      by: ['jobId', 'status'],
      _count: { status: true },
      where: { jobId },
    });

    const entity = toUploadJobEntity(job);
    if (aggregates.length > 0) {
      entity.itemCounts = this.buildItemCounts(aggregates);
    }

    return entity;
  }

  async listJobItems(
    jobId: string,
    query: PaginationQueryDto,
  ): Promise<{
    job: UploadJobEntity;
    data: UploadJobItemEntity[];
    page: { page: number; size: number; total: number };
  }> {
    const job = await this.prisma.uploadJob.findUnique({ where: { id: jobId } });

    if (!job) {
      throw new NotFoundException('업로드 작업을 찾을 수 없습니다.');
    }

    const page = query.page ?? 1;
    const size = query.size ?? 20;
    const skip = (page - 1) * size;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.uploadJobItem.findMany({
        where: { jobId },
        skip,
        take: size,
        orderBy: { rowNo: 'asc' },
      }),
      this.prisma.uploadJobItem.count({ where: { jobId } }),
    ]);

    const aggregates = await this.prisma.uploadJobItem.groupBy({
      by: ['jobId', 'status'],
      _count: { status: true },
      where: { jobId },
    });

    const jobEntity = toUploadJobEntity(job);
    if (aggregates.length > 0) {
      jobEntity.itemCounts = this.buildItemCounts(aggregates);
    }

    return {
      job: jobEntity,
      data: items.map(toUploadJobItemEntity),
      page: {
        page,
        size,
        total,
      },
    };
  }

  private buildItemCounts(
    aggregates: Array<{ jobId: string; status: UploadStatus; _count: { status: number } }>,
  ): UploadJobItemCounts {
    const baseCounts: Record<UploadStatus, number> = {
      queued: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    for (const aggregate of aggregates) {
      baseCounts[aggregate.status] = aggregate._count.status;
    }

    const total = Object.values(baseCounts).reduce((acc, value) => acc + value, 0);

    return {
      total,
      completed: baseCounts.completed,
      failed: baseCounts.failed,
      processing: baseCounts.processing,
      queued: baseCounts.queued,
    };
  }
}
