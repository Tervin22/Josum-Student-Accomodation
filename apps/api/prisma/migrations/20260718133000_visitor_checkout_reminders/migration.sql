ALTER TABLE "VisitorLog" ADD COLUMN "checkoutReminderSentAt" TIMESTAMP(3);

CREATE INDEX "VisitorLog_checkoutReminderSentAt_idx" ON "VisitorLog"("checkoutReminderSentAt");
