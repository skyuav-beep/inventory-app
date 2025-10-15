import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Resource } from '@prisma/client';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PermissionsGuard } from '../permissions/guards/permissions.guard';
import { RequirePermission } from '../permissions/decorators/require-permissions.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';
import { ActiveUser } from '../auth/decorators/active-user.decorator';
import { ActiveUserData } from '../auth/types/active-user-data';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermission(Resource.settings)
  async listUsers(@Query() query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const size = query.size ?? 20;

    const result = await this.usersService.paginate({ page, size });

    return {
      data: result.data,
      page: {
        page,
        size,
        total: result.total,
      },
    };
  }

  @Post()
  @RequirePermission(Resource.settings, 'write')
  async createUser(
    @Body() createUserDto: CreateUserDto,
    @ActiveUser() activeUser: ActiveUserData,
    @Req() request: Request,
  ) {
    const user = await this.usersService.createUser(createUserDto, {
      actor: activeUser,
      ip: request.ip ?? request.socket?.remoteAddress,
      userAgent: request.get('user-agent') ?? undefined,
    });
    return user;
  }
}
