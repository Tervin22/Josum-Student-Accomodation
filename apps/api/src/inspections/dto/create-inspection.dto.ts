import { ApiPropertyOptional } from '@nestjs/swagger';
import { InspectionRating, InspectionSeverity, InspectionStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateInspectionDto {
  @IsUUID()
  periodId: string;

  @IsUUID()
  residenceId: string;

  @IsUUID()
  roomId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  occupantNames?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  studentFullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  studentNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  emailAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  keyNumberIssued?: string;

  @Type(() => Date)
  @IsDate()
  inspectionDate: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  checkInDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  checkOutDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  certifiedIdCopy?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  proofOfRegistration?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  academicRecord?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  proofOfFunding?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  signedLeaseAgreement?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  itemBroughtIn1?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  itemBroughtIn2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  itemBroughtIn3?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  itemBroughtIn4?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  itemBroughtIn5?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  moveInBedroom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  moveOutBedroom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  moveInWalls?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  moveOutWalls?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  moveInCeiling?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  moveOutCeiling?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  moveInLights?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  moveOutLights?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  moveInPlugs?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  moveOutPlugs?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  moveInCupboards?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  moveOutCupboards?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  moveInDoorLockKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  moveOutDoorLockKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  moveInTiling?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  moveOutTiling?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  moveInFridge?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  moveOutFridge?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  moveInBed?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  moveOutBed?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  moveInWindowBlind?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  moveOutWindowBlind?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  moveInWindowFrame?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  moveOutWindowFrame?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  moveInOther?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  moveOutOther?: string;

  @ApiPropertyOptional({ enum: InspectionRating })
  @IsOptional()
  @IsEnum(InspectionRating)
  generalCleanliness?: InspectionRating;

  @ApiPropertyOptional({ enum: InspectionRating })
  @IsOptional()
  @IsEnum(InspectionRating)
  walls?: InspectionRating;

  @ApiPropertyOptional({ enum: InspectionRating })
  @IsOptional()
  @IsEnum(InspectionRating)
  doorsAndLocks?: InspectionRating;

  @ApiPropertyOptional({ enum: InspectionRating })
  @IsOptional()
  @IsEnum(InspectionRating)
  windows?: InspectionRating;

  @ApiPropertyOptional({ enum: InspectionRating })
  @IsOptional()
  @IsEnum(InspectionRating)
  flooring?: InspectionRating;

  @ApiPropertyOptional({ enum: InspectionRating })
  @IsOptional()
  @IsEnum(InspectionRating)
  ceiling?: InspectionRating;

  @ApiPropertyOptional({ enum: InspectionRating })
  @IsOptional()
  @IsEnum(InspectionRating)
  lighting?: InspectionRating;

  @ApiPropertyOptional({ enum: InspectionRating })
  @IsOptional()
  @IsEnum(InspectionRating)
  electricalSockets?: InspectionRating;

  @ApiPropertyOptional({ enum: InspectionRating })
  @IsOptional()
  @IsEnum(InspectionRating)
  plumbing?: InspectionRating;

  @ApiPropertyOptional({ enum: InspectionRating })
  @IsOptional()
  @IsEnum(InspectionRating)
  bathroomCondition?: InspectionRating;

  @ApiPropertyOptional({ enum: InspectionRating })
  @IsOptional()
  @IsEnum(InspectionRating)
  furnitureCondition?: InspectionRating;

  @ApiPropertyOptional({ enum: InspectionRating })
  @IsOptional()
  @IsEnum(InspectionRating)
  bedCondition?: InspectionRating;

  @ApiPropertyOptional({ enum: InspectionRating })
  @IsOptional()
  @IsEnum(InspectionRating)
  wardrobeCondition?: InspectionRating;

  @ApiPropertyOptional({ enum: InspectionRating })
  @IsOptional()
  @IsEnum(InspectionRating)
  appliances?: InspectionRating;

  @ApiPropertyOptional({ enum: InspectionRating })
  @IsOptional()
  @IsEnum(InspectionRating)
  fireSafetyEquipment?: InspectionRating;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  damageIdentified?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  maintenanceRequired?: boolean;

  @ApiPropertyOptional({ enum: InspectionSeverity })
  @IsOptional()
  @IsEnum(InspectionSeverity)
  severity?: InspectionSeverity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  comments?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  studentAcknowledgement?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  inspectorConfirmed?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  studentConfirmed?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  followUpRequired?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  followUpDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  followUpActions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  studentDeclaration?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  studentSignature?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  studentSignatureDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  managementSignatureIn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  managementSignatureOut?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  tenantSignatureIn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  tenantSignatureOut?: string;

  @ApiPropertyOptional({ enum: InspectionStatus })
  @IsOptional()
  @IsEnum(InspectionStatus)
  status?: InspectionStatus;
}
