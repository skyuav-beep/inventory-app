import { Resource } from '@prisma/client';

export interface PermissionDefinition {
  resource: Resource;
  read: boolean;
  write: boolean;
}
