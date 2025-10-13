import { Role } from '@prisma/client';
import { UserPermission } from '../../users/entities/user.entity';

export interface ActiveUserData {
  userId: string;
  email: string;
  name: string;
  role: Role;
  permissions: UserPermission[];
}
