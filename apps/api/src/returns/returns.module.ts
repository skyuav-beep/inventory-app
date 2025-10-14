import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductsModule } from '../products/products.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [PrismaModule, ProductsModule, PermissionsModule, AlertsModule],
  controllers: [ReturnsController],
  providers: [ReturnsService],
})
export class ReturnsModule {}
