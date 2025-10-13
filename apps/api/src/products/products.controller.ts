import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Resource } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/guards/permissions.guard';
import { RequirePermission } from '../permissions/decorators/require-permissions.decorator';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductListQueryDto } from './dto/product-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @RequirePermission(Resource.products, 'write')
  async create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  @RequirePermission(Resource.products)
  async findAll(@Query() query: ProductListQueryDto) {
    const page = query.page ?? 1;
    const size = query.size ?? 20;

    const result = await this.productsService.findAll(query);

    return {
      data: result.data,
      page: {
        page,
        size,
        total: result.total,
      },
    };
  }

  @Get(':id')
  @RequirePermission(Resource.products)
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermission(Resource.products, 'write')
  async update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @RequirePermission(Resource.products, 'write')
  async remove(@Param('id') id: string) {
    await this.productsService.remove(id);
    return { success: true };
  }
}
