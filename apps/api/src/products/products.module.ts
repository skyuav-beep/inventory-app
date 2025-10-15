import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { AlertsModule } from '../alerts/alerts.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, PermissionsModule, AlertsModule, AuditModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
