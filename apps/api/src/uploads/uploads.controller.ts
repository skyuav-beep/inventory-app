import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveUser } from '../auth/decorators/active-user.decorator';
import { ActiveUserData } from '../auth/types/active-user-data';
import { UploadsService } from './uploads.service';
import { memoryStorage } from 'multer';

@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('inbounds')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @HttpCode(HttpStatus.ACCEPTED)
  async uploadInbounds(@UploadedFile() file: Express.Multer.File, @ActiveUser() user: ActiveUserData) {
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
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @HttpCode(HttpStatus.ACCEPTED)
  async uploadOutbounds(@UploadedFile() file: Express.Multer.File, @ActiveUser() user: ActiveUserData) {
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
