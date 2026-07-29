import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpsertSettingDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  @Matches(/^[A-Z0-9_.:-]+$/i, { message: 'key contains unsupported characters' })
  key: string;

  @ApiProperty()
  @IsNotEmpty()
  value: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
