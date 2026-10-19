import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertEmailTemplateDto } from './dto/upsert-email-template.dto';
import { UpsertSettingDto } from './dto/upsert-setting.dto';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listSettings() {
    return this.prisma.systemSetting.findMany({ orderBy: { key: 'asc' } });
  }

  async upsertSetting(actorId: string, dto: UpsertSettingDto) {
    const setting = await this.prisma.systemSetting.upsert({
      where: { key: dto.key },
      create: {
        key: dto.key,
        value: dto.value as Prisma.InputJsonValue,
        description: dto.description,
      },
      update: {
        value: dto.value as Prisma.InputJsonValue,
        description: dto.description,
      },
    });
    await this.audit.log({
      actorId,
      action: 'UPSERT_SYSTEM_SETTING',
      entity: 'SystemSetting',
      entityId: setting.id,
      metadata: { key: dto.key },
    });
    return setting;
  }

  async deleteSetting(actorId: string, key: string) {
    const setting = await this.prisma.systemSetting.delete({ where: { key } });
    await this.audit.log({ actorId, action: 'DELETE_SYSTEM_SETTING', entity: 'SystemSetting', entityId: setting.id });
    return setting;
  }

  listEmailTemplates() {
    return this.prisma.emailTemplate.findMany({ orderBy: { key: 'asc' } });
  }

  async upsertEmailTemplate(actorId: string, dto: UpsertEmailTemplateDto) {
    const template = await this.prisma.emailTemplate.upsert({
      where: { key: dto.key },
      create: {
        key: dto.key,
        subject: dto.subject,
        body: dto.body,
        enabled: dto.enabled ?? true,
        updatedById: actorId,
      },
      update: {
        subject: dto.subject,
        body: dto.body,
        enabled: dto.enabled ?? true,
        updatedById: actorId,
      },
    });
    await this.audit.log({
      actorId,
      action: 'UPSERT_EMAIL_TEMPLATE',
      entity: 'EmailTemplate',
      entityId: template.id,
      metadata: { key: dto.key },
    });
    return template;
  }

  async deleteEmailTemplate(actorId: string, key: string) {
    const template = await this.prisma.emailTemplate.delete({ where: { key } });
    await this.audit.log({ actorId, action: 'DELETE_EMAIL_TEMPLATE', entity: 'EmailTemplate', entityId: template.id });
    return template;
  }
}
