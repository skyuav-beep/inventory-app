import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class TelegramTargetDto {
  @IsString()
  chatId!: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateTelegramSettingsDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsString()
  botToken?: string;

  @IsInt()
  @Min(1)
  @Max(1440)
  cooldownMinutes!: number;

  @IsString()
  @Matches(/^[0-2]\d-[0-2]\d$/)
  quietHours!: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TelegramTargetDto)
  targets?: TelegramTargetDto[];
}
