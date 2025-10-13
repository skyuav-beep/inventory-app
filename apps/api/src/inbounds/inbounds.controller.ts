import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Resource } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/guards/permissions.guard';
import { RequirePermission } from '../permissions/decorators/require-permissions.decorator';
import { CreateInboundDto } from './dto/create-inbound.dto';
import { InboundListQueryDto } from './dto/inbound-query.dto';
import { UpdateInboundDto } from './dto/update-inbound.dto';
import { InboundsService } from './inbounds.service';

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
  async create(@Body() createInboundDto: CreateInboundDto) {
    return this.inboundsService.create(createInboundDto);
  }

  @Get(':id')
  @RequirePermission(Resource.inbounds)
  async findOne(@Param('id') id: string) {
    return this.inboundsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermission(Resource.inbounds, 'write')
  async update(@Param('id') id: string, @Body() updateInboundDto: UpdateInboundDto) {
    return this.inboundsService.update(id, updateInboundDto);
  }

  @Delete(':id')
  @RequirePermission(Resource.inbounds, 'write')
  async remove(@Param('id') id: string) {
    await this.inboundsService.remove(id);
    return { success: true };
  }
}
