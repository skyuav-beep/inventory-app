import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductsModule } from '../products/products.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { InboundsController } from './inbounds.controller';
import { InboundsService } from './inbounds.service';

@Module({
  imports: [PrismaModule, ProductsModule, PermissionsModule],
  controllers: [InboundsController],
  providers: [InboundsService],
})
export class InboundsModule {}
