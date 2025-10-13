import { Resource, Role } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';

class PermissionDto {
  @IsEnum(Resource)
  resource!: Resource;

  @IsBoolean()
  read!: boolean;

  @IsBoolean()
  write!: boolean;
}

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  name!: string;

  @IsEnum(Role)
  role!: Role;

  @IsString()
  @MinLength(8)
  @Matches(/[A-Za-z]/, { message: '비밀번호는 최소 1개의 영문자를 포함해야 합니다.' })
  @Matches(/\d/, { message: '비밀번호는 최소 1개의 숫자를 포함해야 합니다.' })
  password!: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PermissionDto)
  permissions?: PermissionDto[];
}
