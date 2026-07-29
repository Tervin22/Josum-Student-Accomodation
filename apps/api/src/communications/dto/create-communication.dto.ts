import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export const communicationTypes = [
  'POWER_OUTAGE',
  'WATER_OUTAGE',
  'PLANNED_MAINTENANCE',
  'EMERGENCY_MAINTENANCE',
  'GENERAL_COMMUNICATION',
  'CUSTOM_COMMUNICATION',
] as const;

export class CreateCommunicationDto {
  @IsIn(communicationTypes)
  type: (typeof communicationTypes)[number];

  @IsString()
  @MinLength(3)
  @MaxLength(160)
  subject: string;

  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  message: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  residenceId?: string;
}
