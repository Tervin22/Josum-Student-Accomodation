import { defaultEmailTemplates } from './mail.service';

const sentTemplateKeys = [
  'account-created',
  'application-status-changed',
  'application-submitted',
  'documents-required',
  'maintenance-communication',
  'maintenance-resolved',
  'maintenance-sla-reminder',
  'maintenance-status-changed',
  'maintenance-submitted',
  'password-reset',
  'self-paying-payment-reminder',
  'storage-request-status-changed',
  'storage-request-submitted',
  'student-stay-terminated',
  'visitor-checkout-overdue',
  'visitor-pre-registration-status-changed',
  'visitor-pre-registration-submitted',
];

describe('defaultEmailTemplates', () => {
  it('covers every template key sent by the system', () => {
    const missing = sentTemplateKeys.filter((key) => !defaultEmailTemplates[key]);
    expect(missing).toEqual([]);
  });

  it('keeps every default template sendable', () => {
    for (const [key, template] of Object.entries(defaultEmailTemplates)) {
      expect(key).toMatch(/^[A-Z0-9_.:-]+$/i);
      expect(template.subject.trim()).toBeTruthy();
      expect(template.body.trim()).toBeTruthy();
    }
  });
});
