import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Resource } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/guards/permissions.guard';
import { RequirePermission } from '../permissions/decorators/require-permissions.decorator';
import { CreateReturnDto } from './dto/create-return.dto';
import { ReturnListQueryDto } from './dto/return-query.dto';
import { UpdateReturnStatusDto } from './dto/update-return-status.dto';
import { UpdateReturnDto } from './dto/update-return.dto';
import { ReturnsService } from './returns.service';

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
  async create(@Body() createReturnDto: CreateReturnDto) {
    return this.returnsService.create(createReturnDto);
  }

  @Get(':id')
  @RequirePermission(Resource.returns)
  async findOne(@Param('id') id: string) {
    return this.returnsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermission(Resource.returns, 'write')
  async update(@Param('id') id: string, @Body() payload: UpdateReturnDto) {
    return this.returnsService.update(id, payload);
  }

  @Patch(':id/status')
  @RequirePermission(Resource.returns, 'write')
  async updateStatus(@Param('id') id: string, @Body() payload: UpdateReturnStatusDto) {
    return this.returnsService.updateStatus(id, payload);
  }

  @Delete(':id')
  @RequirePermission(Resource.returns, 'write')
  async remove(@Param('id') id: string) {
    await this.returnsService.remove(id);
    return { success: true };
  }
}
