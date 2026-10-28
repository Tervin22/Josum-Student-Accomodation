import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateStorageRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  studentFullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  studentNumber?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  studentSignature!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  studentRoomNumber?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  numberOfItemsStored!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  storageSite?: string;

  @ApiProperty()
  @Transform(({ value }) => value === true || value === 'true' || value === 'on' || value === '1')
  @IsBoolean()
  storageNoticeAccepted!: boolean;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  itemDescription!: string;
}
