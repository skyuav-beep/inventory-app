import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductsModule } from '../products/products.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { OutboundsController } from './outbounds.controller';
import { OutboundsService } from './outbounds.service';

@Module({
  imports: [PrismaModule, ProductsModule, PermissionsModule],
  controllers: [OutboundsController],
  providers: [OutboundsService],
})
export class OutboundsModule {}
