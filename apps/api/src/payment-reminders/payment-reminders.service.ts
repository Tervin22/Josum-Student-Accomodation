import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApplicationStatus, PaymentReminderStatus, Prisma, StayStatus, UserStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

type ReminderPeriod = {
  year: number;
  month: number;
  day: number;
};

type ReminderCandidate = {
  id: string;
  referenceCode: string;
  userId: string;
  acceptedAt: Date | null;
  fundingType: string | null;
  studentNumber: string;
  user: {
    email: string;
    firstName: string;
    lastName: string;
  };
  residence: {
    name: string;
  };
  room: {
    name: string;
  } | null;
};

@Injectable()
export class PaymentRemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentRemindersService.name);
  private sweep?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
      return;
    }
    void this.sendDueReminders().catch((error) => this.logAsyncFailure('Could not send self-paying reminders', error));
    this.sweep = setInterval(() => {
      void this.sendDueReminders().catch((error) => this.logAsyncFailure('Could not send self-paying reminders', error));
    }, this.sweepIntervalMs());
    this.sweep.unref?.();
  }

  onModuleDestroy() {
    if (this.sweep) {
      clearInterval(this.sweep);
    }
  }

  async sendDueReminders(referenceDate = new Date()) {
    const period = this.johannesburgParts(referenceDate);
    if (period.day !== 28) {
      return { periodYear: period.year, periodMonth: period.month, sent: 0, failed: 0, skipped: 0 };
    }

    const candidates = await this.prisma.application.findMany({
      where: {
        status: ApplicationStatus.APPROVED,
        acceptedAt: { not: null },
        roomId: { not: null },
        stayStatus: StayStatus.ACTIVE,
        terminatedAt: null,
        user: {
          status: UserStatus.ACTIVE,
          email: { not: '' },
        },
      },
      take: this.batchSize(),
      orderBy: [{ acceptedAt: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        referenceCode: true,
        userId: true,
        acceptedAt: true,
        fundingType: true,
        studentNumber: true,
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        residence: {
          select: {
            name: true,
          },
        },
        room: {
          select: {
            name: true,
          },
        },
      },
    });

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const application of candidates) {
      if (!this.isSelfPaying(application.fundingType) || !this.firstDueMonthReached(application.acceptedAt, period)) {
        skipped += 1;
        continue;
      }

      const reminder = await this.claimReminder(application, period);
      if (!reminder) {
        skipped += 1;
        continue;
      }

      const emailLog = await this.mail.sendTemplate(application.user.email, 'self-paying-payment-reminder', {
        name: this.fullName(application.user) || application.user.email,
        periodLabel: this.periodLabel(period),
        residenceName: application.residence.name,
        roomName: application.room?.name ?? 'Assigned room',
        studentNumber: application.studentNumber,
        paymentReference: application.studentNumber || application.referenceCode,
        appUrl: this.appUrl(),
      });
      const delivered = emailLog.status === 'SENT';
      await this.prisma.paymentReminder.update({
        where: { id: reminder.id },
        data: {
          status: delivered ? PaymentReminderStatus.SENT : PaymentReminderStatus.FAILED,
          emailLogId: emailLog.id,
          error: delivered ? null : emailLog.error ?? 'Email was not accepted by the SMTP provider',
          sentAt: delivered ? emailLog.sentAt ?? new Date() : null,
        },
      });
      await this.prisma.notification.create({
        data: {
          userId: application.userId,
          title: 'Monthly payment reminder',
          body: `Accommodation payment reminder for ${this.periodLabel(period)}: R5100.`,
        },
      });
      await this.audit.log({
        action: 'SEND_SELF_PAYING_PAYMENT_REMINDER',
        entity: 'PaymentReminder',
        entityId: reminder.id,
        metadata: {
          applicationId: application.id,
          referenceCode: application.referenceCode,
          userId: application.userId,
          recipient: application.user.email,
          periodYear: period.year,
          periodMonth: period.month,
          status: delivered ? 'SENT' : 'FAILED',
        },
      });
      if (delivered) {
        sent += 1;
      } else {
        failed += 1;
      }
    }

    return { periodYear: period.year, periodMonth: period.month, sent, failed, skipped };
  }

  isSelfPaying(value?: string | null) {
    const normalized = value?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '';
    return normalized.includes('selfpay') || normalized.includes('selffund');
  }

  firstDueMonthReached(acceptedAt: Date | null, period: Pick<ReminderPeriod, 'year' | 'month'>) {
    if (!acceptedAt) return false;
    const accepted = this.johannesburgParts(acceptedAt);
    return this.monthIndex(period) > this.monthIndex(accepted);
  }

  private async claimReminder(application: ReminderCandidate, period: ReminderPeriod) {
    try {
      return await this.prisma.paymentReminder.create({
        data: {
          applicationId: application.id,
          userId: application.userId,
          periodYear: period.year,
          periodMonth: period.month,
          recipient: application.user.email,
        },
        select: { id: true },
      });
    } catch (error) {
      if (this.isUniqueConstraint(error)) return null;
      throw error;
    }
  }

  private johannesburgParts(date: Date): ReminderPeriod {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Johannesburg',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    return { year: value('year'), month: value('month'), day: value('day') };
  }

  private monthIndex(period: Pick<ReminderPeriod, 'year' | 'month'>) {
    return period.year * 12 + period.month;
  }

  private periodLabel(period: Pick<ReminderPeriod, 'year' | 'month'>) {
    return new Date(Date.UTC(period.year, period.month - 1, 1)).toLocaleString('en-ZA', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  private fullName(user: { firstName: string; lastName: string }) {
    return `${user.firstName} ${user.lastName}`.trim();
  }

  private appUrl() {
    return this.config.get<string>('PUBLIC_APP_URL') ?? 'http://localhost:3000';
  }

  private batchSize() {
    return this.numberConfig('PAYMENT_REMINDER_BATCH_SIZE', 500);
  }

  private sweepIntervalMs() {
    return this.numberConfig('PAYMENT_REMINDER_SWEEP_INTERVAL_MS', 60 * 60 * 1000);
  }

  private numberConfig(key: string, fallback: number) {
    const value = Number(this.config.get<number | string>(key) ?? fallback);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private isUniqueConstraint(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private logAsyncFailure(message: string, error: unknown) {
    this.logger.error(message, error instanceof Error ? error.stack : String(error));
  }
}
