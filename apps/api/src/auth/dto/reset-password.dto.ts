import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { strongPasswordMessage, strongPasswordPattern } from '../../common/security/password-policy';

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[a-f0-9]{64}$/i, { message: 'token is invalid' })
  token: string;

  @ApiProperty()
  @MinLength(12)
  @MaxLength(128)
  @Matches(strongPasswordPattern, { message: strongPasswordMessage })
  password: string;
}
