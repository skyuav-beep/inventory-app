import { Role } from '@prisma/client';
import { PermissionDefinition } from '../../permissions/types/permission-definition';
import { UserWithPermissions } from '../types/user-with-permissions';

export type UserPermission = PermissionDefinition;

export interface UserEntity {
  id: string;
  email: string;
  name: string;
  role: Role;
  permissions: UserPermission[];
}

export function toUserEntity(user: UserWithPermissions): UserEntity {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    permissions: user.permissions.map((permission) => ({
      resource: permission.resource,
      read: permission.read,
      write: permission.write,
    })),
  };
}
