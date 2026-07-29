import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { DocumentsService } from './documents.service';
import { UploadDocumentDto } from './dto/upload-document.dto';

@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser() user: { sub: string; roles: string[] },
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.documents.upload(user, dto, file);
  }

  @Get('application/:applicationId')
  listForApplication(@CurrentUser() user: { sub: string; roles: string[] }, @Param('applicationId') applicationId: string) {
    return this.documents.listForApplication(user, applicationId);
  }

  @Get(':id/download')
  async download(
    @CurrentUser() user: { sub: string; roles: string[] },
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { document, stream } = await this.documents.download(user, id);
    const filename = this.safeDownloadName(document.originalName);
    response.set({
      'Content-Type': document.mimeType,
      'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Content-Length': document.size,
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(stream);
  }

  private safeDownloadName(filename: string) {
    const safe = filename.replace(/[\r\n"\\/:*?<>|]+/g, '_').trim();
    return safe || 'document';
  }
}
