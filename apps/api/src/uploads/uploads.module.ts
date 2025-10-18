import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductsModule } from '../products/products.module';
import { InboundsModule } from '../inbounds/inbounds.module';
import { OutboundsModule } from '../outbounds/outbounds.module';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { UploadQueueService } from './worker/upload-queue.service';

@Module({
  imports: [PrismaModule, ProductsModule, InboundsModule, OutboundsModule],
  controllers: [UploadsController],
  providers: [UploadsService, UploadQueueService],
})
export class UploadsModule {}
