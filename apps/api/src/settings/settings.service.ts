import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { defaultEmailTemplates } from '../mail/mail.service';
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

  async listEmailTemplates() {
    const customTemplates = await this.prisma.emailTemplate.findMany({ orderBy: { key: 'asc' } });
    const customByKey = new Map(customTemplates.map((template) => [template.key, template]));
    const defaultEntries = Object.entries(defaultEmailTemplates).map(([key, template]) => {
      const custom = customByKey.get(key);
      const subject = custom?.enabled ? custom.subject : template.subject;
      const body = custom?.enabled ? custom.body : template.body;
      return {
        id: custom?.id ?? `default:${key}`,
        key,
        subject,
        body,
        enabled: custom?.enabled ?? true,
        source: custom?.enabled ? 'custom' : 'default',
        isCustomized: Boolean(custom),
        createdAt: custom?.createdAt ?? null,
        updatedAt: custom?.updatedAt ?? null,
        updatedById: custom?.updatedById ?? null,
        placeholders: this.extractPlaceholders(`${subject}\n${body}`),
      };
    });
    const customOnlyEntries = customTemplates
      .filter((template) => !defaultEmailTemplates[template.key])
      .map((template) => ({
        ...template,
        source: 'custom',
        isCustomized: true,
        placeholders: this.extractPlaceholders(`${template.subject}\n${template.body}`),
      }));
    return [...defaultEntries, ...customOnlyEntries].sort((left, right) => left.key.localeCompare(right.key));
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

  private extractPlaceholders(template: string) {
    return [...new Set([...template.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((match) => match[1]))].sort();
  }
}
