import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveUser } from '../auth/decorators/active-user.decorator';
import { ActiveUserData } from '../auth/types/active-user-data';
import { UploadsService } from './uploads.service';
import { UploadJobsQueryDto } from './dto/upload-jobs-query.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Get('jobs')
  async listJobs(@Query() query: UploadJobsQueryDto) {
    const result = await this.uploadsService.listJobs(query);
    return result;
  }

  @Get('jobs/:jobId')
  async getJob(@Param('jobId') jobId: string) {
    return this.uploadsService.getJob(jobId);
  }

  @Get('jobs/:jobId/items')
  async getJobItems(@Param('jobId') jobId: string, @Query() query: PaginationQueryDto) {
    return this.uploadsService.listJobItems(jobId, query);
  }

  @Post('inbounds')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.ACCEPTED)
  async uploadInbounds(@UploadedFile() file: unknown, @ActiveUser() user: ActiveUserData) {
    if (!file) {
      throw new BadRequestException('업로드할 파일이 필요합니다.');
    }

    const job = await this.uploadsService.createUploadJob({
      type: UploadType.inbound,
      file,
      createdById: user.userId,
    });

    return {
      job,
      message: '입고 업로드가 큐에 등록되었습니다.',
    };
  }

  @Post('outbounds')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.ACCEPTED)
  async uploadOutbounds(@UploadedFile() file: unknown, @ActiveUser() user: ActiveUserData) {
    if (!file) {
      throw new BadRequestException('업로드할 파일이 필요합니다.');
    }

    const job = await this.uploadsService.createUploadJob({
      type: UploadType.outbound,
      file,
      createdById: user.userId,
    });

    return {
      job,
      message: '출고 업로드가 큐에 등록되었습니다.',
    };
  }
}
