import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Resource } from '@prisma/client';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/guards/permissions.guard';
import { RequirePermission } from '../permissions/decorators/require-permissions.decorator';
import { CreateInboundDto } from './dto/create-inbound.dto';
import { InboundListQueryDto } from './dto/inbound-query.dto';
import { UpdateInboundDto } from './dto/update-inbound.dto';
import { InboundsService } from './inbounds.service';
import { ActiveUser } from '../auth/decorators/active-user.decorator';
import { ActiveUserData } from '../auth/types/active-user-data';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('inbounds')
export class InboundsController {
  constructor(private readonly inboundsService: InboundsService) {}

  @Get()
  @RequirePermission(Resource.inbounds)
  async findAll(@Query() query: InboundListQueryDto) {
    const page = query.page ?? 1;
    const size = query.size ?? 20;

    const result = await this.inboundsService.findAll(query);

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
  @RequirePermission(Resource.inbounds, 'write')
  async create(
    @Body() createInboundDto: CreateInboundDto,
    @ActiveUser() activeUser: ActiveUserData,
    @Req() request: Request,
  ) {
    return this.inboundsService.create(
      createInboundDto,
      this.buildAuditContext(activeUser, request),
    );
  }

  @Get(':id')
  @RequirePermission(Resource.inbounds)
  async findOne(@Param('id') id: string) {
    return this.inboundsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermission(Resource.inbounds, 'write')
  async update(
    @Param('id') id: string,
    @Body() updateInboundDto: UpdateInboundDto,
    @ActiveUser() activeUser: ActiveUserData,
    @Req() request: Request,
  ) {
    return this.inboundsService.update(
      id,
      updateInboundDto,
      this.buildAuditContext(activeUser, request),
    );
  }

  @Delete(':id')
  @RequirePermission(Resource.inbounds, 'write')
  async remove(
    @Param('id') id: string,
    @ActiveUser() activeUser: ActiveUserData,
    @Req() request: Request,
  ) {
    await this.inboundsService.remove(id, this.buildAuditContext(activeUser, request));
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
