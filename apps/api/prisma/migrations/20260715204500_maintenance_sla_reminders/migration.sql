ALTER TABLE "MaintenanceRequest"
  ADD COLUMN "acknowledgementSlaReminderSentAt" TIMESTAMP(3),
  ADD COLUMN "resolutionSlaReminderSentAt" TIMESTAMP(3);

CREATE INDEX "MaintenanceRequest_acknowledgementSlaReminderSentAt_idx"
  ON "MaintenanceRequest"("acknowledgementSlaReminderSentAt");

CREATE INDEX "MaintenanceRequest_resolutionSlaReminderSentAt_idx"
  ON "MaintenanceRequest"("resolutionSlaReminderSentAt");
