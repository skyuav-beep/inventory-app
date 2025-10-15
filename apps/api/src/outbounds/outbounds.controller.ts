import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Resource } from '@prisma/client';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/guards/permissions.guard';
import { RequirePermission } from '../permissions/decorators/require-permissions.decorator';
import { CreateOutboundDto } from './dto/create-outbound.dto';
import { OutboundListQueryDto } from './dto/outbound-query.dto';
import { UpdateOutboundDto } from './dto/update-outbound.dto';
import { OutboundsService } from './outbounds.service';
import { ActiveUser } from '../auth/decorators/active-user.decorator';
import { ActiveUserData } from '../auth/types/active-user-data';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('outbounds')
export class OutboundsController {
  constructor(private readonly outboundsService: OutboundsService) {}

  @Get()
  @RequirePermission(Resource.outbounds)
  async findAll(@Query() query: OutboundListQueryDto) {
    const page = query.page ?? 1;
    const size = query.size ?? 20;

    const result = await this.outboundsService.findAll(query);

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
  @RequirePermission(Resource.outbounds, 'write')
  async create(
    @Body() createOutboundDto: CreateOutboundDto,
    @ActiveUser() activeUser: ActiveUserData,
    @Req() request: Request,
  ) {
    return this.outboundsService.create(createOutboundDto, this.buildAuditContext(activeUser, request));
  }

  @Get(':id')
  @RequirePermission(Resource.outbounds)
  async findOne(@Param('id') id: string) {
    return this.outboundsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermission(Resource.outbounds, 'write')
  async update(
    @Param('id') id: string,
    @Body() updateOutboundDto: UpdateOutboundDto,
    @ActiveUser() activeUser: ActiveUserData,
    @Req() request: Request,
  ) {
    return this.outboundsService.update(id, updateOutboundDto, this.buildAuditContext(activeUser, request));
  }

  @Delete(':id')
  @RequirePermission(Resource.outbounds, 'write')
  async remove(@Param('id') id: string, @ActiveUser() activeUser: ActiveUserData, @Req() request: Request) {
    await this.outboundsService.remove(id, this.buildAuditContext(activeUser, request));
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
