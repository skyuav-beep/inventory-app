import { IsEnum } from 'class-validator';
import { UploadType } from '@prisma/client';

export class CreateUploadDto {
  @IsEnum(UploadType)
  type!: UploadType;
}
