import { ApplicationStatus, PaymentReminderStatus, StayStatus, UserStatus } from '@prisma/client';
import { PaymentRemindersService } from './payment-reminders.service';

const application = (overrides: Record<string, unknown> = {}) => ({
  id: 'application-1',
  referenceCode: 'JSA-1',
  userId: 'student-1',
  acceptedAt: new Date('2026-07-10T08:00:00.000Z'),
  fundingType: 'Self Funding',
  studentNumber: 'STU-001',
  user: {
    email: 'student@example.com',
    firstName: 'Student',
    lastName: 'One',
  },
  residence: { name: 'Josum 1' },
  room: { name: 'Room 1' },
  ...overrides,
});

function createService(candidates = [application()]) {
  const prisma = {
    application: {
      findMany: jest.fn().mockResolvedValue(candidates),
    },
    paymentReminder: {
      create: jest.fn().mockResolvedValue({ id: 'reminder-1' }),
      update: jest.fn().mockResolvedValue({}),
    },
    notification: {
      create: jest.fn().mockResolvedValue({}),
    },
  };
  const mail = {
    sendTemplate: jest.fn().mockResolvedValue({
      id: 'email-log-1',
      status: 'SENT',
      sentAt: new Date('2026-08-28T08:00:00.000Z'),
    }),
  };
  const audit = {
    log: jest.fn().mockResolvedValue({}),
  };
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'PUBLIC_APP_URL') return 'https://portal.example.com';
      return undefined;
    }),
  };

  return {
    service: new PaymentRemindersService(prisma as never, mail as never, audit as never, config as never),
    prisma,
    mail,
    audit,
  };
}

describe('PaymentRemindersService', () => {
  it('sends reminders only to due self-paying accepted residents', async () => {
    const { service, mail, prisma } = createService([
      application(),
      application({ id: 'application-2', userId: 'student-2', fundingType: 'NSFAS' }),
    ]);

    const result = await service.sendDueReminders(new Date('2026-08-28T08:00:00.000Z'));

    expect(result).toMatchObject({ sent: 1, failed: 0, skipped: 1 });
    expect(mail.sendTemplate).toHaveBeenCalledTimes(1);
    expect(mail.sendTemplate).toHaveBeenCalledWith(
      'student@example.com',
      'self-paying-payment-reminder',
      expect.objectContaining({
        periodLabel: 'August 2026',
        residenceName: 'Josum 1',
        roomName: 'Room 1',
        paymentReference: 'STU-001',
      }),
    );
    expect(prisma.paymentReminder.update).toHaveBeenCalledWith({
      where: { id: 'reminder-1' },
      data: expect.objectContaining({ status: PaymentReminderStatus.SENT, emailLogId: 'email-log-1' }),
    });
  });

  it('does not send before the first month after acceptance', async () => {
    const { service, mail } = createService([
      application({ acceptedAt: new Date('2026-08-02T08:00:00.000Z') }),
    ]);

    const result = await service.sendDueReminders(new Date('2026-08-28T08:00:00.000Z'));

    expect(result).toMatchObject({ sent: 0, skipped: 1 });
    expect(mail.sendTemplate).not.toHaveBeenCalled();
  });

  it('does not send twice for the same application and month', async () => {
    const { Prisma } = await import('@prisma/client');
    const { service, mail, prisma } = createService();
    prisma.paymentReminder.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    const result = await service.sendDueReminders(new Date('2026-08-28T08:00:00.000Z'));

    expect(result).toMatchObject({ sent: 0, skipped: 1 });
    expect(mail.sendTemplate).not.toHaveBeenCalled();
  });

  it('queries only active accepted stays that are not terminated', async () => {
    const { service, prisma } = createService([]);

    await service.sendDueReminders(new Date('2026-08-28T08:00:00.000Z'));

    expect(prisma.application.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: ApplicationStatus.APPROVED,
          acceptedAt: { not: null },
          roomId: { not: null },
          stayStatus: StayStatus.ACTIVE,
          terminatedAt: null,
          user: expect.objectContaining({ status: UserStatus.ACTIVE }),
        }),
      }),
    );
  });
});
