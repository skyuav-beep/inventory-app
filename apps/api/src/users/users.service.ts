import { ConflictException, Injectable } from '@nestjs/common';
import { AuditAction, Prisma, Resource, Role } from '@prisma/client';
import { hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../permissions/permissions.service';
import { UserEntity, toUserEntity } from './entities/user.entity';
import { UserWithPermissions } from './types/user-with-permissions';
import { CreateUserDto } from './dto/create-user.dto';
import { AuditService } from '../audit/audit.service';
import { ActiveUserData } from '../auth/types/active-user-data';

interface AuditContext {
  actor?: ActiveUserData | null;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
    private readonly auditService: AuditService,
  ) {}

  async findByEmail(email: string): Promise<UserWithPermissions | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { permissions: true },
    });

    if (!user || user.disabled) {
      return null;
    }

    return user;
  }

  async findById(id: string): Promise<UserWithPermissions | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { permissions: true },
    });

    if (!user || user.disabled) {
      return null;
    }

    return user;
  }

  async getActiveUserEntity(id: string): Promise<UserEntity | null> {
    const user = await this.findById(id);
    if (!user) {
      return null;
    }

    return toUserEntity(user);
  }

  async paginate({
    page,
    size,
  }: {
    page: number;
    size: number;
  }): Promise<{ data: UserEntity[]; total: number }> {
    const take = size;
    const skip = (page - 1) * size;

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        skip,
        take,
        where: { disabled: false },
        include: { permissions: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where: { disabled: false } }),
    ]);

    return {
      data: users.map(toUserEntity),
      total,
    };
  }

  async createUser(payload: CreateUserDto, context?: AuditContext): Promise<UserEntity> {
    const role = payload.role ?? Role.operator;
    const hashedPassword = await hash(payload.password, 12);

    try {
      const user = await this.prisma.user.create({
        data: {
          email: payload.email,
          name: payload.name,
          role,
          passwordHash: hashedPassword,
          permissions: {
            create: this.permissionsService.buildCreateInput(
              payload.permissions,
              role,
            ),
          },
        },
        include: { permissions: true },
      });

      const entity = toUserEntity(user);

      await this.auditService.record({
        userId: context?.actor?.userId,
        resource: Resource.settings,
        action: AuditAction.create,
        entityId: entity.id,
        payload: this.toJsonValue({ email: payload.email, role: payload.role }),
        ipAddress: context?.ip,
        userAgent: context?.userAgent,
      });

      return entity;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('이미 존재하는 이메일입니다.');
      }

      throw error;
    }
  }

  private toJsonValue(value: unknown) {
    if (value === undefined || value === null) {
      return undefined;
    }

    try {
      return JSON.parse(JSON.stringify(value)) as Prisma.JsonValue;
    } catch {
      return undefined;
    }
  }
}
