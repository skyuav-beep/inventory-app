import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ActiveUserData } from '../../auth/types/active-user-data';
import { PermissionsService } from '../permissions.service';
import {
  REQUIRE_PERMISSIONS_KEY,
  RequiredPermission,
} from '../decorators/require-permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requirements =
      this.reflector.getAllAndOverride<RequiredPermission[]>(
        REQUIRE_PERMISSIONS_KEY,
        [context.getHandler(), context.getClass()],
      );

    if (!requirements || requirements.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: ActiveUserData;
    }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('권한이 없습니다.');
    }

    const hasAllPermissions = requirements.every((requirement) =>
      this.permissionsService.hasPermission(
        user.permissions,
        requirement.resource,
        requirement.action,
      ),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException('권한이 없습니다.');
    }

    return true;
  }
}

