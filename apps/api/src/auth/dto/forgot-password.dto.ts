import { ApiProperty } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, MaxLength } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({
    enum: RoleName,
    required: false,
    description: 'Optional account role used to match the email before sending a password reset link.',
  })
  @IsOptional()
  @IsEnum(RoleName)
  role?: RoleName;
}
