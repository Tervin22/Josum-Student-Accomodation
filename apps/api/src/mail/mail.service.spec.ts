import { createTransport } from 'nodemailer';
import { MailService } from './mail.service';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

function setup() {
  const sendMail = jest.fn().mockResolvedValue({ accepted: ['student@example.invalid'], rejected: [] });
  jest.mocked(createTransport).mockReturnValue({ sendMail } as never);
  const prisma = { emailTemplate: { findUnique: jest.fn().mockResolvedValue(null) }, emailLog: { create: jest.fn(({ data }) => Promise.resolve(data)) } };
  const service = new MailService({ get: jest.fn() } as never, prisma as never);
  return { service, sendMail };
}

describe('Residence email templates', () => {
  it('records disabled delivery without contacting SMTP in client preview mode', async () => {
    const sendMail = jest.fn();
    jest.mocked(createTransport).mockReturnValue({ sendMail } as never);
    const prisma = { emailLog: { create: jest.fn(({ data }) => Promise.resolve(data)) } };
    const config = { get: jest.fn((key: string) => key === 'CLIENT_PREVIEW_MODE' ? 'true' : undefined) };
    const service = new MailService(config as never, prisma as never);
    const result = await service.send({ to: 'client@example.invalid', subject: 'Preview', text: 'Test message' });
    expect(sendMail).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ status: 'FAILED', error: 'Email delivery is disabled in the temporary client-testing environment.' }));
  });
  it('requires STARTTLS for production SMTP when implicit TLS is not configured', () => {
    const config = { get: jest.fn((key: string) => key === 'NODE_ENV' ? 'production' : undefined) };
    new MailService(config as never, {} as never);
    expect(createTransport).toHaveBeenLastCalledWith(expect.objectContaining({ requireTLS: true }));
  });
  it('includes the chosen residence and reference without obsolete dated document instructions', async () => {
    const { service, sendMail } = setup();
    await service.sendTemplate('student@example.invalid', 'documents-required', { name: 'Student', referenceCode: 'RES-123', residenceName: 'Res Roma', residenceAddress: 'Test address', appUrl: 'https://portal.example.invalid' });
    const message = sendMail.mock.calls[0][0];
    expect(message.text).toContain('Res Roma');
    expect(message.text).toContain('RES-123');
    expect(message.text).not.toContain('2024');
    expect(message.text).not.toMatch(/\{\{/);
    expect(message.html).not.toContain('src=""');
  });
  it('renders a residence-specific amount without the former banking instructions', async () => {
    const { service, sendMail } = setup();
    await service.sendTemplate('student@example.invalid', 'self-paying-payment-reminder', { name: 'Student', residenceName: 'Botlogile 2', amount: 'R4,200.00', periodLabel: 'November 2026', paymentReference: 'STU-123', appUrl: 'https://portal.example.invalid' });
    const message = sendMail.mock.calls[0][0];
    expect(message.text).toContain('Botlogile 2');
    expect(message.text).toContain('R4,200.00');
    expect(message.text).not.toMatch(/Josum|5[,.]?100|Account Number/i);
    expect(message.text).not.toMatch(/\{\{/);
  });
});
