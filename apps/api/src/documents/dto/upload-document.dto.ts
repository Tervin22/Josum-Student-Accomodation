import { ApiProperty } from '@nestjs/swagger';
import { DocumentType } from '@prisma/client';
import { IsEnum, IsUUID } from 'class-validator';

export class UploadDocumentDto {
  @ApiProperty()
  @IsUUID()
  applicationId: string;

  @ApiProperty({ enum: DocumentType })
  @IsEnum(DocumentType)
  type: DocumentType;
}
