import { Permission, User } from '@prisma/client';

export type UserWithPermissions = User & {
  permissions: Permission[];
};
