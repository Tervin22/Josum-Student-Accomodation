import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class FactoryResetDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  recoveryKey: string;
}
