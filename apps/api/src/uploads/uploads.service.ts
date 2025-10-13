import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'node:crypto';
import { CreateUploadDto } from './dto/create-upload.dto';
import { UploadJobEntity, toUploadJobEntity } from './entities/upload-job.entity';
import { UploadQueueService } from './worker/upload-queue.service';

@Injectable()
export class UploadsService {
  private readonly storageDir = path.join(process.cwd(), 'storage', 'uploads');

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: UploadQueueService,
  ) {}

  async createUploadJob(
    dto: CreateUploadDto & { createdById?: string | null; file: Express.Multer.File },
  ): Promise<UploadJobEntity> {
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

    await this.queueService.enqueue(job.id);

    return toUploadJobEntity(job);
  }

  private async persistFile(file: Express.Multer.File): Promise<{ filename: string; originalName: string }> {
    await fs.mkdir(this.storageDir, { recursive: true });

    const ext = path.extname(file.originalname);
    const filename = `${randomUUID()}${ext}`;
    const filePath = path.join(this.storageDir, filename);

    await fs.writeFile(filePath, file.buffer);

    return {
      filename,
      originalName: file.originalname,
    };
  }

  async getJob(jobId: string): Promise<UploadJobEntity> {
    const job = await this.prisma.uploadJob.findUnique({ where: { id: jobId } });

    if (!job) {
      throw new NotFoundException('업로드 작업을 찾을 수 없습니다.');
    }

    return toUploadJobEntity(job);
  }
}
