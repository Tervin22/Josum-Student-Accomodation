import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { MailModule } from '../mail/mail.module';
import { PaymentRemindersService } from './payment-reminders.service';

@Module({
  imports: [AuditModule, MailModule],
  providers: [PaymentRemindersService],
  exports: [PaymentRemindersService],
})
export class PaymentRemindersModule {}
