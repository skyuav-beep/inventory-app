import { UploadStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class UploadJobsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(UploadStatus)
  status?: UploadStatus;
}
