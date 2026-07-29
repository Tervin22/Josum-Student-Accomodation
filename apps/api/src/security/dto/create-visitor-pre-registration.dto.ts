import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const phonePattern = /^[0-9+()\-\s]{7,20}$/;

export class CreateVisitorPreRegistrationDto {
  @IsString()
  @MaxLength(120)
  visitorName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(phonePattern, { message: 'visitorPhone must be a valid phone number' })
  visitorPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  visitorIdNumber?: string;

  @IsString()
  @MaxLength(80)
  relationship: string;

  @Type(() => Date)
  @IsDate()
  expectedVisitDate: Date;

  @IsString()
  @MaxLength(10)
  expectedArrivalTime: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  vehicleRegistration?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsBoolean()
  termsAccepted: boolean;
}
