import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Resource } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/guards/permissions.guard';
import { RequirePermission } from '../permissions/decorators/require-permissions.decorator';
import { AuditService } from './audit.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @RequirePermission(Resource.settings)
  async listLogs(@Query() query: AuditLogQueryDto) {
    const page = query.page ?? 1;
    const size = query.size ?? 20;

    const result = await this.auditService.listLogs({
      page,
      size,
      resource: query.resource,
      action: query.action,
    });

    return {
      data: result.data,
      page: {
        page,
        size,
        total: result.total,
      },
    };
  }
}
