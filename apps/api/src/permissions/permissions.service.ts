import { Injectable } from '@nestjs/common';
import { Prisma, Resource, Role } from '@prisma/client';
import { PermissionAction } from './types/permission-action';
import { PermissionDefinition } from './types/permission-definition';

type PermissionInput = {
  resource: Resource;
  read: boolean;
  write: boolean;
};

@Injectable()
export class PermissionsService {
  private readonly operatorWritableResources = new Set<Resource>([
    Resource.products,
    Resource.inbounds,
    Resource.outbounds,
    Resource.returns,
  ]);

  listResources(): Resource[] {
    return Object.values(Resource);
  }

  hasPermission(
    permissions: PermissionDefinition[],
    resource: Resource,
    action: PermissionAction,
  ): boolean {
    const permission = permissions.find((item) => item.resource === resource);

    if (!permission) {
      return false;
    }

    if (action === 'read') {
      return permission.read || permission.write;
    }

    return permission.write;
  }

  getDefaultPermissions(role: Role): PermissionDefinition[] {
    return this.listResources().map((resource) => ({
      resource,
      read: true,
      write: this.canWriteByDefault(role, resource),
    }));
  }

  mergeWithDefaults(
    permissions: PermissionInput[] | undefined,
    role: Role,
  ): PermissionDefinition[] {
    const defaults = this.getDefaultPermissions(role);

    if (!permissions || permissions.length === 0) {
      return defaults;
    }

    const overrides = new Map<Resource, PermissionDefinition>();
    permissions.forEach((permission) => {
      overrides.set(permission.resource, {
        resource: permission.resource,
        read: permission.read,
        write: permission.write,
      });
    });

    return defaults.map(
      (defaultPermission) => overrides.get(defaultPermission.resource) ?? defaultPermission,
    );
  }

  buildCreateInput(
    permissions: PermissionInput[] | undefined,
    role: Role,
  ): Prisma.PermissionCreateWithoutUserInput[] {
    return this.mergeWithDefaults(permissions, role).map((permission) => ({
      resource: permission.resource,
      read: permission.read,
      write: permission.write,
    }));
  }

  getRoleTemplates(): Record<Role, PermissionDefinition[]> {
    return {
      [Role.admin]: this.getDefaultPermissions(Role.admin),
      [Role.operator]: this.getDefaultPermissions(Role.operator),
      [Role.viewer]: this.getDefaultPermissions(Role.viewer),
    };
  }

  private canWriteByDefault(role: Role, resource: Resource): boolean {
    if (role === Role.admin) {
      return true;
    }

    if (role === Role.viewer) {
      return false;
    }

    if (role === Role.operator) {
      return this.operatorWritableResources.has(resource);
    }

    return false;
  }
}
