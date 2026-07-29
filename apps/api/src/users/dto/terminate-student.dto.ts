import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class TerminateStudentDto {
  @ApiProperty({ description: 'Reason or note sent to the student and stored on the stay record.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;
}
