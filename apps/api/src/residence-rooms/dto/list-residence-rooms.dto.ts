import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ListResidenceRoomsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  residenceId?: string;
}
