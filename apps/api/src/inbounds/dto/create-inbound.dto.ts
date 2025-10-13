import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class CreateInboundDto {
  @IsString()
  productId!: string;

  @IsInt()
  @IsPositive()
  quantity!: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateIn?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
