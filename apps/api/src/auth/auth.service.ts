import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { toUserEntity } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './types/jwt-payload';
import { ActiveUserData } from './types/active-user-data';
import { AuditService } from '../audit/audit.service';
import { AuditAction, Prisma, Resource } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  async validateUserByEmail(email: string, password: string): Promise<ActiveUserData> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const isPasswordValid = await compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const safeUser = toUserEntity(user);

    return {
      userId: safeUser.id,
      email: safeUser.email,
      name: safeUser.name,
      role: safeUser.role,
      permissions: safeUser.permissions,
    };
  }

  async login(
    loginDto: LoginDto,
    context?: { ip?: string; userAgent?: string },
  ): Promise<{ accessToken: string }> {
    const activeUser = await this.validateUserByEmail(loginDto.email, loginDto.password);

    const payload: JwtPayload = {
      sub: activeUser.userId,
      email: activeUser.email,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    await this.auditService.record({
      userId: activeUser.userId,
      resource: Resource.settings,
      action: AuditAction.login,
      entityId: activeUser.userId,
      payload: this.toJsonValue({ email: activeUser.email }),
      ipAddress: context?.ip,
      userAgent: context?.userAgent,
    });

    return { accessToken };
  }

  private toJsonValue(value: unknown): Prisma.JsonValue | undefined {
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
