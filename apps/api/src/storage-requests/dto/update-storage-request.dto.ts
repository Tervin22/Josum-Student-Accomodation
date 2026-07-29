import { ApiPropertyOptional } from '@nestjs/swagger';
import { StorageRequestStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateStorageRequestDto {
  @ApiPropertyOptional({ enum: StorageRequestStatus })
  @IsOptional()
  @IsEnum(StorageRequestStatus)
  status?: StorageRequestStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1200)
  reviewNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  managementSignature?: string;
}
