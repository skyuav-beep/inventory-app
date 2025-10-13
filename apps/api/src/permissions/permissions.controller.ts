import { Controller, Get, Param, ParseEnumPipe, UseGuards } from '@nestjs/common';
import { Role, Resource } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsService } from './permissions.service';
import { PermissionsGuard } from './guards/permissions.guard';
import { RequirePermission } from './decorators/require-permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get('resources')
  @RequirePermission(Resource.settings)
  listResources() {
    return {
      data: this.permissionsService.listResources(),
    };
  }

  @Get('templates')
  @RequirePermission(Resource.settings)
  listRoleTemplates() {
    return {
      data: this.permissionsService.getRoleTemplates(),
    };
  }

  @Get('templates/:role')
  @RequirePermission(Resource.settings)
  getRoleTemplate(@Param('role', new ParseEnumPipe(Role)) role: Role) {
    return {
      data: this.permissionsService.getDefaultPermissions(role),
    };
  }
}

