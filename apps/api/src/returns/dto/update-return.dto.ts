import { ReturnStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateReturnDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  quantity?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  reason?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateReturn?: Date;

  @IsOptional()
  @IsEnum(ReturnStatus)
  status?: ReturnStatus;
}

