import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Resource } from '@prisma/client';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/guards/permissions.guard';
import { RequirePermission } from '../permissions/decorators/require-permissions.decorator';
import { CreateReturnDto } from './dto/create-return.dto';
import { ReturnListQueryDto } from './dto/return-query.dto';
import { UpdateReturnStatusDto } from './dto/update-return-status.dto';
import { UpdateReturnDto } from './dto/update-return.dto';
import { ReturnsService } from './returns.service';
import { ActiveUser } from '../auth/decorators/active-user.decorator';
import { ActiveUserData } from '../auth/types/active-user-data';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('returns')
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Get()
  @RequirePermission(Resource.returns)
  async findAll(@Query() query: ReturnListQueryDto) {
    const page = query.page ?? 1;
    const size = query.size ?? 20;

    const result = await this.returnsService.findAll(query);

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
  @RequirePermission(Resource.returns, 'write')
  async create(
    @Body() createReturnDto: CreateReturnDto,
    @ActiveUser() activeUser: ActiveUserData,
    @Req() request: Request,
  ) {
    return this.returnsService.create(createReturnDto, this.buildAuditContext(activeUser, request));
  }

  @Get(':id')
  @RequirePermission(Resource.returns)
  async findOne(@Param('id') id: string) {
    return this.returnsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermission(Resource.returns, 'write')
  async update(
    @Param('id') id: string,
    @Body() payload: UpdateReturnDto,
    @ActiveUser() activeUser: ActiveUserData,
    @Req() request: Request,
  ) {
    return this.returnsService.update(id, payload, this.buildAuditContext(activeUser, request));
  }

  @Patch(':id/status')
  @RequirePermission(Resource.returns, 'write')
  async updateStatus(
    @Param('id') id: string,
    @Body() payload: UpdateReturnStatusDto,
    @ActiveUser() activeUser: ActiveUserData,
    @Req() request: Request,
  ) {
    return this.returnsService.updateStatus(id, payload, this.buildAuditContext(activeUser, request));
  }

  @Delete(':id')
  @RequirePermission(Resource.returns, 'write')
  async remove(@Param('id') id: string, @ActiveUser() activeUser: ActiveUserData, @Req() request: Request) {
    await this.returnsService.remove(id, this.buildAuditContext(activeUser, request));
    return { success: true };
  }

  private buildAuditContext(activeUser: ActiveUserData | undefined, request: Request) {
    return {
      actor: activeUser,
      ip: request.ip ?? request.socket?.remoteAddress,
      userAgent: request.get('user-agent') ?? undefined,
    };
  }
}
