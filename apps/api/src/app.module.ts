import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { PermissionsModule } from './permissions/permissions.module';
import { ProductsModule } from './products/products.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { InboundsModule } from './inbounds/inbounds.module';
import { OutboundsModule } from './outbounds/outbounds.module';
import { ReturnsModule } from './returns/returns.module';
import { SettingsModule } from './settings/settings.module';
import { AlertsModule } from './alerts/alerts.module';
import { UploadsModule } from './uploads/uploads.module';
import { HealthModule } from './health/health.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60,
        limit: 120,
      },
      {
        name: 'alerts',
        ttl: 60,
        limit: 20,
      },
    ]),
    PrismaModule,
    UsersModule,
    PermissionsModule,
    AuthModule,
    ProductsModule,
    DashboardModule,
    InboundsModule,
    OutboundsModule,
    ReturnsModule,
    SettingsModule,
    AlertsModule,
    UploadsModule,
    HealthModule,
    AuditModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
