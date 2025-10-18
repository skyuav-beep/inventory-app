import { SetMetadata } from '@nestjs/common';
import { Resource } from '@prisma/client';
import { PermissionAction } from '../types/permission-action';

export const REQUIRE_PERMISSIONS_KEY = 'require_permissions';

export interface RequiredPermission {
  resource: Resource;
  action: PermissionAction;
}

export const RequirePermissions = (...permissions: RequiredPermission[]) =>
  SetMetadata(REQUIRE_PERMISSIONS_KEY, permissions);

export const RequirePermission = (resource: Resource, action: PermissionAction = 'read') =>
  RequirePermissions({ resource, action });
