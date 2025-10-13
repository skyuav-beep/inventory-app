import { AlertLevel, Channel } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class AlertListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsEnum(AlertLevel)
  level?: AlertLevel;

  @IsOptional()
  @IsEnum(Channel)
  channel?: Channel;
}
