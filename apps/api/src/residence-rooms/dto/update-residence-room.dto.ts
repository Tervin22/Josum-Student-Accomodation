import { ApiProperty } from '@nestjs/swagger';
import { ResidenceRoomStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateResidenceRoomDto {
  @ApiProperty({ enum: ResidenceRoomStatus })
  @IsEnum(ResidenceRoomStatus)
  status: ResidenceRoomStatus;
}
