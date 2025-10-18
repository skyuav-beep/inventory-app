import { Resource, Role } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class UpdatePermissionDto {
  @IsEnum(Resource)
  resource!: Resource;

  @IsBoolean()
  read!: boolean;

  @IsBoolean()
  write!: boolean;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdatePermissionDto)
  permissions?: UpdatePermissionDto[];
}
