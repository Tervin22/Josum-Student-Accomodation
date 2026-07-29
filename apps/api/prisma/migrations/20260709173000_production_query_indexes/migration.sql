CREATE INDEX "Application_userId_status_idx"
  ON "Application"("userId", "status");

CREATE INDEX "Application_residenceId_status_createdAt_idx"
  ON "Application"("residenceId", "status", "createdAt");

CREATE INDEX "Notification_userId_createdAt_idx"
  ON "Notification"("userId", "createdAt");

CREATE INDEX "Notification_userId_readAt_createdAt_idx"
  ON "Notification"("userId", "readAt", "createdAt");

CREATE INDEX "MaintenanceRequest_userId_createdAt_idx"
  ON "MaintenanceRequest"("userId", "createdAt");

CREATE INDEX "MaintenanceRequest_status_createdAt_idx"
  ON "MaintenanceRequest"("status", "createdAt");

CREATE INDEX "EmailLog_status_createdAt_idx"
  ON "EmailLog"("status", "createdAt");

CREATE INDEX "AuditLog_entity_createdAt_idx"
  ON "AuditLog"("entity", "createdAt");
