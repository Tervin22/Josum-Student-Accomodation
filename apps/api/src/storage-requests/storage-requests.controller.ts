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
import { RoleName } from '@prisma/client';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { STORAGE_MANAGEMENT_ROLES } from '../common/roles/role-groups';
import { CreateStorageRequestDto } from './dto/create-storage-request.dto';
import { ListStorageRequestsDto } from './dto/list-storage-requests.dto';
import { UpdateStorageRequestDto } from './dto/update-storage-request.dto';
import { StorageRequestsService } from './storage-requests.service';

type StorageUploadFiles = {
  storageForm?: Express.Multer.File[];
  itemImages?: Express.Multer.File[];
};

const uploadLimits = {
  files: 7,
  fileSize: 10 * 1024 * 1024,
};

@ApiTags('storage-requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('storage-requests')
export class StorageRequestsController {
  constructor(private readonly storageRequests: StorageRequestsService) {}

  @Get('form-template')
  @Roles(RoleName.STUDENT, ...STORAGE_MANAGEMENT_ROLES)
  downloadFormTemplate(@Res({ passthrough: true }) response: Response) {
    const body = this.storageRequests.storageFormTemplate();
    const filename = 'josum-student-storage-form.txt';
    response.set({
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Content-Length': Buffer.byteLength(body),
      'X-Content-Type-Options': 'nosniff',
    });
    return body;
  }

  @Post()
  @Roles(RoleName.STUDENT)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'storageForm', maxCount: 1 },
        { name: 'itemImages', maxCount: 6 },
      ],
      { limits: uploadLimits },
    ),
  )
  create(
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateStorageRequestDto,
    @UploadedFiles() files: StorageUploadFiles,
  ) {
    return this.storageRequests.create(user.sub, dto, files.storageForm?.[0], files.itemImages ?? []);
  }

  @Get('mine')
  @Roles(RoleName.STUDENT)
  listMine(@CurrentUser() user: { sub: string }) {
    return this.storageRequests.listMine(user.sub);
  }

  @Patch(':id/request-release')
  @Roles(RoleName.STUDENT)
  requestRelease(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.storageRequests.requestRelease(user.sub, id);
  }

  @Get('admin/export')
  @Roles(...STORAGE_MANAGEMENT_ROLES)
  async exportAdmin(
    @Query() query: ListStorageRequestsDto,
    @CurrentUser() user: { sub: string },
    @Res({ passthrough: true }) response: Response,
  ) {
    const body = await this.storageRequests.exportAdminCsv(user.sub, query);
    const filename = `josum-storage-requests-${new Date().toISOString().slice(0, 10)}.csv`;
    response.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Content-Length': Buffer.byteLength(body),
      'X-Content-Type-Options': 'nosniff',
    });
    return body;
  }

  @Get('admin')
  @Roles(...STORAGE_MANAGEMENT_ROLES)
  listAdmin(@Query() query: ListStorageRequestsDto) {
    return this.storageRequests.listAdmin(query);
  }

  @Patch('admin/:id')
  @Roles(...STORAGE_MANAGEMENT_ROLES)
  updateAdmin(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: UpdateStorageRequestDto,
  ) {
    return this.storageRequests.updateAdmin(user.sub, id, dto);
  }

  @Get('files/:id/download')
  @Roles(RoleName.STUDENT, ...STORAGE_MANAGEMENT_ROLES)
  async downloadFile(
    @CurrentUser() user: { sub: string; roles: string[] },
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { file, stream } = await this.storageRequests.downloadFile(user, id);
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
    return safe || 'storage-file';
  }
}
