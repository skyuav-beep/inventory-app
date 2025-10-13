import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class CreateOutboundDto {
  @IsString()
  productId!: string;

  @IsInt()
  @IsPositive()
  quantity!: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateOut?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
