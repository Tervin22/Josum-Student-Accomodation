import { defaultEmailTemplates } from '../mail/mail.service';
import { SettingsService } from './settings.service';

describe('SettingsService email templates', () => {
  it('returns default templates merged with custom overrides', async () => {
    const customTemplate = {
      id: 'template-1',
      key: 'application-submitted',
      subject: 'Custom application {{referenceCode}}',
      body: 'Hello {{name}}, custom body.',
      enabled: true,
      updatedById: 'admin-1',
      createdAt: new Date('2026-10-08T08:00:00.000Z'),
      updatedAt: new Date('2026-10-08T08:05:00.000Z'),
    };
    const prisma = {
      emailTemplate: {
        findMany: jest.fn().mockResolvedValue([customTemplate]),
      },
    };
    const service = new SettingsService(prisma as never, { log: jest.fn() } as never);

    const templates = await service.listEmailTemplates();
    const submitted = templates.find((template) => template.key === 'application-submitted');
    const reset = templates.find((template) => template.key === 'password-reset');

    expect(templates.length).toBeGreaterThanOrEqual(Object.keys(defaultEmailTemplates).length);
    expect(submitted).toMatchObject({
      id: customTemplate.id,
      subject: customTemplate.subject,
      body: customTemplate.body,
      source: 'custom',
      isCustomized: true,
    });
    expect(reset).toMatchObject({
      id: 'default:password-reset',
      subject: defaultEmailTemplates['password-reset'].subject,
      body: defaultEmailTemplates['password-reset'].body,
      source: 'default',
      isCustomized: false,
    });
    expect(reset?.placeholders).toEqual(expect.arrayContaining(['appName', 'name', 'resetUrl']));
  });
});
