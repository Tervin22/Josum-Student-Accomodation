import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateResidenceRoomDto {
  @ApiProperty() @IsUUID() residenceId: string;
  @ApiProperty() @IsUUID() roomTypeId: string;
  @ApiProperty() @IsInt() @Min(1) @Max(100000) roomNumber: number;
  @ApiProperty({ enum: ['Male', 'Female'] }) @IsIn(['Male', 'Female']) genderAllocation: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) name?: string;
}
