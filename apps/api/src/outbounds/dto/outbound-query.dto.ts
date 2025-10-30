import type { $Enums } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const OUTBOUND_STATUS = {
  shipped: 'shipped',
  in_transit: 'in_transit',
  delivered: 'delivered',
  returned: 'returned',
} as const satisfies Record<string, $Enums.OutboundStatus>;

type OutboundStatus = (typeof OUTBOUND_STATUS)[keyof typeof OUTBOUND_STATUS];

export class OutboundListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsEnum(OUTBOUND_STATUS)
  status?: OutboundStatus;
}
