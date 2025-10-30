import { AuditAction, Resource } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class AuditLogQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => String)
  @IsEnum(Resource)
  resource?: Resource;

  @IsOptional()
  @Type(() => String)
  @IsEnum(AuditAction)
  action?: AuditAction;
}
