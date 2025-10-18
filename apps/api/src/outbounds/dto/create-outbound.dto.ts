import { $Enums } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class CreateOutboundDto {
  @IsString()
  productId!: string;

  @IsInt()
  @IsPositive()
  quantity!: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  orderDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateOut?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ordererId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ordererName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  recipientName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  recipientPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  recipientAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  recipientPostalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  customsNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  invoiceNumber?: string;

  @IsOptional()
  @IsEnum($Enums.OutboundStatus)
  status?: $Enums.OutboundStatus;
}
