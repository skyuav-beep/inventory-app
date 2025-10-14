import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductsModule } from '../products/products.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { OutboundsController } from './outbounds.controller';
import { OutboundsService } from './outbounds.service';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [PrismaModule, ProductsModule, PermissionsModule, AlertsModule],
  controllers: [OutboundsController],
  providers: [OutboundsService],
  exports: [OutboundsService],
})
export class OutboundsModule {}
