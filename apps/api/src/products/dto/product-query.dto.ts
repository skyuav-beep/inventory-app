import { ProductStatus } from '@prisma/client';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const transformOptionalBoolean = ({ value }: TransformFnParams) => {
  const rawValue: unknown = value;

  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return undefined;
  }

  if (typeof rawValue === 'boolean') {
    return rawValue;
  }

  if (typeof rawValue === 'string') {
    const normalized = rawValue.trim().toLowerCase();

    if (normalized === 'true') {
      return true;
    }

    if (normalized === 'false') {
      return false;
    }
  }

  return undefined;
};

export class ProductListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  search?: string;

  @IsOptional()
  @Type(() => String)
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  disabled?: boolean;

  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  includeDisabled?: boolean;
}
