import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpsertEmailTemplateDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  @Matches(/^[A-Z0-9_.:-]+$/i, { message: 'key contains unsupported characters' })
  key: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  subject: string;

  @ApiProperty()
  @IsString()
  @MaxLength(20000)
  body: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
