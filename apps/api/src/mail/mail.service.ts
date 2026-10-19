import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

type TemplateVariables = Record<string, string | number | null | undefined>;

const defaultAppName = 'Josum Student Accommodation';
const defaultLogoUrl = 'https://josumres.co.za/wp-content/uploads/2025/08/Josum-Company-Logo-Final-Homepage.png';

const defaultTemplates: Record<string, { subject: string; body: string }> = {
  'account-created': {
    subject: 'Your {{appName}} account is ready',
    body: 'Hello {{name}},\n\nYour {{role}} account has been created successfully.\n\nSign in here: {{appUrl}}',
  },
  'password-reset': {
    subject: 'Reset your {{appName}} password',
    body: 'Hello {{name}},\n\nUse this secure link to reset your password: {{resetUrl}}\n\nIf you did not request this, you can ignore this email.',
  },
  'application-submitted': {
    subject: 'Application received: {{referenceCode}}',
    body: 'Hello {{name}},\n\nYour accommodation application has been submitted and is awaiting review.\n\nApplication reference: {{referenceCode}}\nResidence: {{residenceName}}\nAddress: {{residenceAddress}}\nStatus: Submitted\n\nWe will keep you informed as your application progresses.\n\nKind regards,\n{{appName}}',
  },
  'documents-required': {
    subject: 'Documents required for application {{referenceCode}}',
    body: "Hello {{name}},\n\nYour accommodation application has been received, but no supporting documents have been uploaded yet.\n\nApplication reference: {{referenceCode}}\nResidence: {{residenceName}}\nAddress: {{residenceAddress}}\nStatus: Submitted\n\nPlease sign in and upload the required documents so the application can be reviewed:\n\n- Applicant's ID / Passport copy\n- 2 x Student color ID Photos\n- Student's Acceptance Letter\n- Guarantor's ID / Passport copy, pay slip, 3 Months Bank statement, and proof of address\n- Medical Aid Certificate valid until November 2024 (International students only)\n\nUpload here: {{appUrl}}\n\nKind regards,\n{{appName}}",
  },
  'application-status-changed': {
    subject: '{{statusSubject}}',
    body: 'Hello {{name}},\n\n{{openingMessage}}\n\nApplication reference: {{referenceCode}}\nCurrent status: {{toStatus}}\nResidence: {{residenceName}}\nAddress: {{residenceAddress}}\n\n{{detailMessage}}\n\n{{nextStepMessage}}{{studentNoteBlock}}\n\nYou can sign in to view your application here: {{appUrl}}\n\nKind regards,\n{{appName}}',
  },
  'maintenance-submitted': {
    subject: 'Maintenance request received: {{referenceCode}}',
    body: 'Hello {{name}},\n\nYour maintenance request {{referenceCode}} has been submitted.\n\nIssue: {{title}}\n\nThe administration team will review and resolve it as soon as possible.',
  },
  'maintenance-resolved': {
    subject: 'Maintenance request {{referenceCode}} resolved',
    body: 'Hello {{name}},\n\nYour maintenance request {{referenceCode}} has been marked as resolved.\n\nIssue: {{title}}\n\nResolution note:\n{{resolutionNote}}',
  },
  'maintenance-status-changed': {
    subject: '{{maintenanceStatusSubject}}',
    body: 'Hello {{name}},\n\n{{maintenanceOpeningMessage}}\n\nRequest reference: {{referenceCode}}\nCurrent stage: {{toStatus}}\nIssue: {{title}}\nAcknowledged / updated by: {{administratorName}}\n\n{{maintenanceDetailMessage}}{{resolutionNoteBlock}}\n\nYou can sign in to view the request here: {{appUrl}}\n\nKind regards,\n{{appName}}',
  },
  'maintenance-sla-reminder': {
    subject: '{{slaSubject}}',
    body: 'Hello {{name}},\n\n{{slaMessage}}\n\nRequest reference: {{referenceCode}}\nIssue: {{title}}\nPriority: {{priority}}\nDeadline: {{deadline}}\n\nPlease sign in and update the maintenance ticket here: {{appUrl}}\n\nKind regards,\n{{appName}}',
  },
  'storage-request-submitted': {
    subject: 'Storage request received: {{referenceCode}}',
    body: 'Hello {{name}},\n\nYour student storage request {{referenceCode}} has been submitted for review.\n\nYou can view its status here: {{appUrl}}\n\nKind regards,\n{{appName}}',
  },
  'storage-request-status-changed': {
    subject: 'Storage request {{referenceCode}} updated',
    body: 'Hello {{name}},\n\nYour student storage request {{referenceCode}} moved to {{toStatus}}.{{reviewNoteBlock}}\n\nYou can view the latest status here: {{appUrl}}\n\nKind regards,\n{{appName}}',
  },
  'maintenance-communication': {
    subject: '{{subject}}',
    body: 'Hello {{name}},\n\n{{communicationType}}\n\n{{message}}\n\nKind regards,\n{{appName}}',
  },
  'visitor-checkout-overdue': {
    subject: 'Visitor checkout overdue: {{visitorName}}',
    body: 'Hello {{name}},\n\nA visitor has not been checked out by the 10:00 PM deadline.\n\nVisitor: {{visitorName}}\nPhone: {{visitorPhone}}\nID / Passport: {{visitorIdNumber}}\nResident: {{residentName}}\nStudent number: {{studentNumber}}\nResidence: {{residenceName}}\nRoom: {{roomName}}\nRelationship: {{relationship}}\nPurpose: {{purpose}}\nVehicle: {{vehicleRegistration}}\nChecked in: {{checkedInAt}}\nCheckout deadline: {{checkoutDueAt}}\nChecked in by: {{recordedByName}}\nNotes: {{notes}}\n\nPlease sign in and follow up from the security dashboard: {{appUrl}}\n\nKind regards,\n{{appName}}',
  },
  'visitor-pre-registration-submitted': {
    subject: 'Visitor pre-registration awaiting approval: {{visitorName}}',
    body: 'Hello {{name}},\n\nA student has submitted a visitor pre-registration for security approval.\n\nVisitor: {{visitorName}}\nPhone: {{visitorPhone}}\nID / Passport: {{visitorIdNumber}}\nStudent: {{studentName}}\nStudent number: {{studentNumber}}\nResidence: {{residenceName}}\nRoom: {{roomName}}\nRelationship: {{relationship}}\nExpected visit date: {{expectedVisitDate}}\nExpected arrival time: {{expectedArrivalTime}}\nVehicle: {{vehicleRegistration}}\nNotes: {{notes}}\n\nPlease sign in to the security dashboard to approve or reject it: {{appUrl}}\n\nKind regards,\n{{appName}}',
  },
  'visitor-pre-registration-status-changed': {
    subject: 'Visitor pre-registration {{status}}: {{visitorName}}',
    body: 'Hello {{name}},\n\nYour visitor pre-registration has been {{status}}.\n\nVisitor: {{visitorName}}\nExpected visit date: {{expectedVisitDate}}\nExpected arrival time: {{expectedArrivalTime}}\nResidence: {{residenceName}}\nRoom: {{roomName}}{{noteBlock}}\n\nYou can view the latest visitor status here: {{appUrl}}\n\nKind regards,\n{{appName}}',
  },
  'self-paying-payment-reminder': {
    subject: 'Monthly accommodation payment reminder: R5100 due',
    body: 'Hello {{name}},\n\nThis is your monthly accommodation payment reminder for {{periodLabel}}.\n\nAmount due: R5100\nResidence: {{residenceName}}\nRoom: {{roomName}}\nStudent number: {{studentNumber}}\n\nBanking details:\nAccount holder: Josum Investments (Pty) Ltd\nBank: FNB\nAccount number: 62930055042\nBranch code: 250655\nReference: {{paymentReference}}\n\nPlease make payment on or before the due date and keep proof of payment for your records.\n\nYou can sign in here: {{appUrl}}\n\nKind regards,\n{{appName}}',
  },
  'student-stay-terminated': {
    subject: 'Your accommodation stay has been terminated',
    body: 'Hello {{name}},\n\nYour accommodation stay has been terminated by the administration team.\n\nResidence: {{residenceName}}\nRoom: {{roomName}}\nStudent number: {{studentNumber}}\nTermination date: {{terminatedAt}}\n\nReason / note:\n{{terminationReason}}\n\nYour student account has been deactivated and you will not be able to register again unless an administrator whitelists your details.\n\nPlease contact the administration team if you need assistance.\n\nKind regards,\n{{appName}}',
  },
  'admin-created': {
    subject: '{{appName}} administrator access created',
    body: 'Hello {{name}},\n\nYour administrator account is ready. Sign in at {{appUrl}}.',
  },
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const smtpUser = this.config.get<string>('SMTP_USER');
    this.transporter = createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port: this.config.get<number>('SMTP_PORT'),
      secure: this.config.get<boolean>('SMTP_SECURE'),
      auth: smtpUser
        ? {
            user: smtpUser,
            pass: this.config.get<string>('SMTP_PASSWORD'),
          }
        : undefined,
    });
  }

  async sendTemplate(to: string, templateKey: string, variables: TemplateVariables) {
    const databaseTemplate = await this.prisma.emailTemplate.findUnique({
      where: { key: templateKey },
    });
    const template = databaseTemplate?.enabled ? databaseTemplate : defaultTemplates[templateKey];
    if (!template) {
      throw new Error(`Email template not found: ${templateKey}`);
    }

    const brandedVariables = {
      ...variables,
      appName: this.appName(),
      logoUrl: this.logoUrl(),
    };
    const subject = this.render(template.subject, brandedVariables);
    const text = this.render(template.body, brandedVariables);
    return this.send({ to, subject, text, templateKey });
  }

  async send(input: { to: string; subject: string; text: string; templateKey?: string }) {
    try {
      const info = await this.transporter.sendMail({
        to: input.to,
        from: this.config.get<string>('SMTP_FROM'),
        replyTo: this.config.get<string>('SMTP_USER') || undefined,
        subject: input.subject,
        text: input.text,
        html: this.toHtml(input.text),
        headers: {
          'Auto-Submitted': 'auto-generated',
          'X-Entity-Ref-ID': `${input.templateKey ?? 'mail'}-${randomUUID()}`,
        },
      });
      const accepted = this.toStringList((info as { accepted?: unknown[] }).accepted);
      const rejected = this.toStringList((info as { rejected?: unknown[] }).rejected);
      if (!this.includesAddress(accepted, input.to) || this.includesAddress(rejected, input.to)) {
        throw new Error(`SMTP did not accept recipient ${input.to}`);
      }
      this.logger.log(`Email accepted by SMTP for ${input.to}`);
      return this.prisma.emailLog.create({
        data: {
          recipient: input.to,
          subject: input.subject,
          templateKey: input.templateKey,
          status: 'SENT',
          sentAt: new Date(),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown email error';
      this.logger.error(message);
      return this.prisma.emailLog.create({
        data: {
          recipient: input.to,
          subject: input.subject,
          templateKey: input.templateKey,
          status: 'FAILED',
          error: message,
        },
      });
    }
  }

  private render(template: string, variables: TemplateVariables) {
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => String(variables[key] ?? ''));
  }

  private appName() {
    return this.config.get<string>('APP_NAME') ?? defaultAppName;
  }

  private logoUrl() {
    return this.config.get<string>('BRAND_LOGO_URL') ?? defaultLogoUrl;
  }

  private toStringList(value: unknown[] | undefined) {
    return (value ?? []).map((item) => String(item).toLowerCase());
  }

  private includesAddress(addresses: string[], address: string) {
    const normalized = address.toLowerCase();
    return addresses.some((item) => item === normalized || item.includes(`<${normalized}>`));
  }

  private toHtml(text: string) {
    const body = text
      .split(/\n{2,}/)
      .map((paragraph) => `<p>${this.escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
      .join('');
    return `
      <div style="margin:0;padding:24px;background:#f6f8fb;font-family:Arial,Helvetica,sans-serif;color:#172033;">
        <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #dde5ef;border-radius:10px;padding:24px;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
            <img src="${this.escapeHtml(this.logoUrl())}" alt="${this.escapeHtml(this.appName())}" width="72" style="display:block;max-width:72px;height:auto;border:0;" />
            <div style="font-size:18px;font-weight:700;color:#172033;">${this.escapeHtml(this.appName())}</div>
          </div>
          <div style="font-size:15px;line-height:1.55;color:#27364a;">${body}</div>
          <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5edf5;font-size:12px;color:#667085;">
            <img src="${this.escapeHtml(this.logoUrl())}" alt="${this.escapeHtml(this.appName())}" width="96" style="display:block;max-width:96px;height:auto;border:0;margin-bottom:8px;" />
            ${this.escapeHtml(this.appName())}<br />
            This is an automated system notification.
          </div>
        </div>
      </div>
    `;
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
