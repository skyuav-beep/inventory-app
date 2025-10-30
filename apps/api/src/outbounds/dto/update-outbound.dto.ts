import type { $Enums } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

const OUTBOUND_STATUS = {
  shipped: 'shipped',
  in_transit: 'in_transit',
  delivered: 'delivered',
  returned: 'returned',
} as const satisfies Record<string, $Enums.OutboundStatus>;

type OutboundStatus = (typeof OUTBOUND_STATUS)[keyof typeof OUTBOUND_STATUS];

export class UpdateOutboundDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  quantity?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateOut?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  memo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  specialNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  freightType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  paymentCondition?: string;

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
  @MaxLength(100)
  invoiceNumber?: string;

  @IsOptional()
  @IsEnum(OUTBOUND_STATUS)
  status?: OutboundStatus;
}
