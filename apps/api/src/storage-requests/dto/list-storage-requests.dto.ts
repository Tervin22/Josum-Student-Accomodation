import { ApiPropertyOptional } from '@nestjs/swagger';
import { StorageRequestStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ListStorageRequestsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: StorageRequestStatus })
  @IsOptional()
  @IsEnum(StorageRequestStatus)
  status?: StorageRequestStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  residenceId?: string;
}
