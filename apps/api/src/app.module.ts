import { Module } from '@nestjs/common';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
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
  ],
})
export class AppModule {}
