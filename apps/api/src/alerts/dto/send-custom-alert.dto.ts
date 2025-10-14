import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendCustomAlertDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message!: string;
}
