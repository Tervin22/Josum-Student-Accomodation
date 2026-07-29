import { Body, Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UpsertEmailTemplateDto } from './dto/upsert-email-template.dto';
import { UpsertSettingDto } from './dto/upsert-setting.dto';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleName.ADMINISTRATOR)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  listSettings() {
    return this.settings.listSettings();
  }

  @Put()
  upsertSetting(@CurrentUser() user: { sub: string }, @Body() dto: UpsertSettingDto) {
    return this.settings.upsertSetting(user.sub, dto);
  }

  @Delete(':key')
  deleteSetting(@CurrentUser() user: { sub: string }, @Param('key') key: string) {
    return this.settings.deleteSetting(user.sub, key);
  }

  @Get('email-templates')
  listEmailTemplates() {
    return this.settings.listEmailTemplates();
  }

  @Put('email-templates')
  upsertEmailTemplate(@CurrentUser() user: { sub: string }, @Body() dto: UpsertEmailTemplateDto) {
    return this.settings.upsertEmailTemplate(user.sub, dto);
  }

  @Delete('email-templates/:key')
  deleteEmailTemplate(@CurrentUser() user: { sub: string }, @Param('key') key: string) {
    return this.settings.deleteEmailTemplate(user.sub, key);
  }
}
