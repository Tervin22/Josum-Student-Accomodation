import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

const phonePattern = /^[0-9+()\-\s]{7,20}$/;

export class CreateVisitorLogDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  studentNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  preRegistrationId?: string;

  @ApiProperty()
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  residentName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  relationship?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  residenceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  purpose?: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  overrideReason?: string;
}
