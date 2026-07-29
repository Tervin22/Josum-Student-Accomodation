import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export const visitorPreRegistrationStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'CHECKED_IN'] as const;

export class ListVisitorPreRegistrationsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  residenceId?: string;

  @ApiPropertyOptional({ enum: visitorPreRegistrationStatuses })
  @IsOptional()
  @IsIn(visitorPreRegistrationStatuses)
  status?: string;
}
