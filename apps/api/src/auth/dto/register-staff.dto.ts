import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { strongPasswordMessage, strongPasswordPattern } from '../../common/security/password-policy';

export const staffRegistrationRoleNames = ['MANAGER', 'SECURITY', 'TECHNICIAN'] as const;
export type StaffRegistrationRoleName = (typeof staffRegistrationRoleNames)[number];

export class RegisterStaffDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty()
  @MinLength(12)
  @Matches(strongPasswordPattern, { message: strongPasswordMessage })
  password: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  firstName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  lastName: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9+()\-\s]{7,20}$/, { message: 'phone must be a valid phone number' })
  phone?: string;

  @ApiProperty({ enum: staffRegistrationRoleNames })
  @IsIn(staffRegistrationRoleNames)
  role: StaffRegistrationRoleName;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  registrationKey: string;
}
