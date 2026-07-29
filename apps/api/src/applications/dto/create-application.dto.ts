import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Equals,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

const phonePattern = /^[0-9+()\-\s]{7,20}$/;
const signatureDataUrlPattern = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/;

export class CreateApplicationDto {
  @ApiProperty()
  @IsBoolean()
  @Equals(true, { message: 'Only NWU Vaal Triangle students may continue with this application' })
  isNwuStudent: boolean;

  @ApiProperty()
  @IsString()
  @IsIn(['FIRST YEAR', 'SECOND YEAR', 'THIRD YEAR (FINAL YEAR)', 'FOURTH YEAR (FINAL YEAR)', 'EXTENDED'])
  studyYear: string;

  @ApiProperty()
  @IsString()
  @IsIn(['FIRST AND SECOND SEMESTER', 'FIRST SEMESTER ONLY', 'SECOND SEMESTER ONLY'])
  studySemester: string;

  @ApiProperty()
  @IsBoolean()
  returningStudent: boolean;

  @ApiProperty()
  @IsString()
  @IsIn(['NEW_STUDENT', 'RETURNING_STUDENT', 'TRANSFER_STUDENT', 'INTERNATIONAL_STUDENT'])
  applicantCategory: string;

  @ApiProperty()
  @IsString()
  @IsIn(['REGISTERED', 'PROVISIONALLY_ACCEPTED', 'NOT_REGISTERED_YET'])
  academicRegistrationStatus: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  roomId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  applicantFirstName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  applicantLastName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  studentIdNumber: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  studentNumber: string;

  @ApiProperty()
  @IsString()
  @Matches(phonePattern, { message: 'studentPhone must be a valid phone number' })
  studentPhone: string;

  @ApiProperty()
  @IsUUID()
  residenceId: string;

  @ApiProperty()
  @IsUUID()
  roomTypeId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  institutionName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  courseName: string;

  @ApiProperty()
  @IsDateString()
  dateOfOccupation: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nationality: string;

  @ApiProperty()
  @IsString()
  @IsIn(['Female', 'Male', 'Other'])
  gender: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z0-9 -]{3,20}$/, { message: 'postalCode must be a valid postal code' })
  postalCode: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  studentAdvisorDetails?: string;

  @ApiProperty()
  @IsString()
  @IsIn(['Once Off', 'Quarterly', 'Monthly'])
  paymentTerm: string;

  @ApiPropertyOptional()
  @IsString()
  @IsIn(['NSFAS', 'Private Bursary', 'Self Funding', 'Other'])
  fundingType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  fundingReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  specialRequirements?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  guarantorFullName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  guarantorIdPassport?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(phonePattern, { message: 'guarantorCell must be a valid phone number' })
  guarantorCell: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  guarantorEmail: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  guarantorAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  guarantorNationality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  guarantorEmployer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  nextOfKin1Name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nextOfKin1Relationship?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(phonePattern, { message: 'nextOfKin1Cell must be a valid phone number' })
  nextOfKin1Cell?: string;

  @ApiProperty()
  @IsBoolean()
  hasMedicalConditions: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  nextOfKin2Name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nextOfKin2Relationship?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(phonePattern, { message: 'nextOfKin2Cell must be a valid phone number' })
  nextOfKin2Cell?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  nextOfKin3Name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nextOfKin3Relationship?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(phonePattern, { message: 'nextOfKin3Cell must be a valid phone number' })
  nextOfKin3Cell?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  medicalDetails?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  additionalInformation?: string;

  @ApiProperty()
  @IsBoolean()
  @Equals(true, { message: 'termsAccepted must be accepted before submitting the application' })
  termsAccepted: boolean;

  @ApiProperty()
  @IsBoolean()
  @Equals(true, { message: 'declarationAccepted must be accepted before submitting the application' })
  declarationAccepted: boolean;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  electronicSignatureName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  electronicSignatureIdPassport: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500000)
  @Matches(signatureDataUrlPattern, { message: 'signatureDataUrl must be a valid PNG or JPEG signature image' })
  signatureDataUrl: string;
}
