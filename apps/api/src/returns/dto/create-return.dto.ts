import { ReturnStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateReturnDto {
  @IsString()
  productId!: string;

  @IsInt()
  @IsPositive()
  quantity!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  reason!: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateReturn?: Date;

  @IsOptional()
  @IsEnum(ReturnStatus)
  status?: ReturnStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  outboundId?: string;
}
