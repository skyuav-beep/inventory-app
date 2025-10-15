import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductsModule } from '../products/products.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { InboundsController } from './inbounds.controller';
import { InboundsService } from './inbounds.service';
import { AlertsModule } from '../alerts/alerts.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, ProductsModule, PermissionsModule, AlertsModule, AuditModule],
  controllers: [InboundsController],
  providers: [InboundsService],
  exports: [InboundsService],
})
export class InboundsModule {}
