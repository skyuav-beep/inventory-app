import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class InboundListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  productId?: string;
}
