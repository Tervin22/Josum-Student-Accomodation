import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { INSPECTION_MANAGEMENT_ROLES } from '../common/roles/role-groups';
import { CreateInspectionPeriodDto } from './dto/create-inspection-period.dto';
import { CreateInspectionDto } from './dto/create-inspection.dto';
import { ListInspectionsDto } from './dto/list-inspections.dto';
import { UpdateInspectionDto } from './dto/update-inspection.dto';
import { InspectionsService } from './inspections.service';

type InspectionUploadFiles = {
  photos?: Express.Multer.File[];
};

const uploadLimits = {
  files: 8,
  fileSize: 10 * 1024 * 1024,
};

@ApiTags('inspections')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...INSPECTION_MANAGEMENT_ROLES)
@Controller('inspections')
export class InspectionsController {
  constructor(private readonly inspections: InspectionsService) {}

  @Get('periods')
  listPeriods() {
    return this.inspections.listPeriods();
  }

  @Post('periods')
  createPeriod(@CurrentUser() user: { sub: string }, @Body() dto: CreateInspectionPeriodDto) {
    return this.inspections.createPeriod(user.sub, dto);
  }

  @Get('export')
  async export(
    @CurrentUser() user: { sub: string },
    @Query() query: ListInspectionsDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const body = await this.inspections.exportCsv(user.sub, query);
    const filename = `josum-inspections-${new Date().toISOString().slice(0, 10)}.csv`;
    response.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Content-Length': Buffer.byteLength(body),
      'X-Content-Type-Options': 'nosniff',
    });
    return body;
  }

  @Get()
  list(@Query() query: ListInspectionsDto) {
    return this.inspections.list(query);
  }

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'photos', maxCount: 8 }], { limits: uploadLimits }))
  create(
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateInspectionDto,
    @UploadedFiles() files: InspectionUploadFiles,
  ) {
    return this.inspections.create(user.sub, dto, files.photos ?? []);
  }

  @Patch(':id')
  update(@CurrentUser() user: { sub: string }, @Param('id') id: string, @Body() dto: UpdateInspectionDto) {
    return this.inspections.update(user.sub, id, dto);
  }

  @Get('attachments/:id/download')
  async downloadAttachment(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { file, stream } = await this.inspections.downloadAttachment(user.sub, id);
    const filename = this.safeDownloadName(file.originalName);
    response.set({
      'Content-Type': file.mimeType,
      'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Content-Length': file.size,
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(stream);
  }

  private safeDownloadName(filename: string) {
    const safe = filename.replace(/[\r\n"\\/:*?<>|]+/g, '_').trim();
    return safe || 'inspection-photo';
  }
}
