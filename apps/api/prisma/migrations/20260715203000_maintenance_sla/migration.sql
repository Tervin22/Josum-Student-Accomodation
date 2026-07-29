ALTER TABLE "MaintenanceRequest"
  ADD COLUMN "acknowledgementDeadlineAt" TIMESTAMP(3),
  ADD COLUMN "acknowledgedAt" TIMESTAMP(3),
  ADD COLUMN "acknowledgedById" UUID,
  ADD COLUMN "assignedTechnicianId" UUID,
  ADD COLUMN "resolutionDeadlineAt" TIMESTAMP(3),
  ADD COLUMN "slaAcknowledgementBreachedAt" TIMESTAMP(3),
  ADD COLUMN "slaResolutionBreachedAt" TIMESTAMP(3),
  ADD COLUMN "slaStatus" TEXT NOT NULL DEFAULT 'ACK_PENDING';

UPDATE "MaintenanceRequest"
SET "acknowledgementDeadlineAt" = "createdAt" + INTERVAL '24 hours'
WHERE "acknowledgementDeadlineAt" IS NULL;

UPDATE "MaintenanceRequest"
SET
  "acknowledgedAt" = COALESCE("acknowledgedAt", "updatedAt"),
  "acknowledgedById" = COALESCE("acknowledgedById", "resolvedById"),
  "assignedTechnicianId" = COALESCE("assignedTechnicianId", "resolvedById")
WHERE "status" IN ('ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

UPDATE "MaintenanceRequest"
SET "resolutionDeadlineAt" =
  COALESCE("acknowledgedAt", "createdAt") +
  CASE
    WHEN "priority" IN ('HIGH', 'URGENT') THEN INTERVAL '12 hours'
    ELSE INTERVAL '48 hours'
  END
WHERE "status" IN ('ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')
  AND "resolutionDeadlineAt" IS NULL;

UPDATE "MaintenanceRequest"
SET
  "slaAcknowledgementBreachedAt" = COALESCE("slaAcknowledgementBreachedAt", CURRENT_TIMESTAMP),
  "slaStatus" = 'ACK_BREACHED'
WHERE "status" = 'OPEN'
  AND "acknowledgementDeadlineAt" <= CURRENT_TIMESTAMP;

UPDATE "MaintenanceRequest"
SET
  "slaResolutionBreachedAt" = COALESCE("slaResolutionBreachedAt", CURRENT_TIMESTAMP),
  "slaStatus" = 'RESOLUTION_BREACHED'
WHERE "status" IN ('ACKNOWLEDGED', 'IN_PROGRESS')
  AND "resolutionDeadlineAt" <= CURRENT_TIMESTAMP;

UPDATE "MaintenanceRequest"
SET "slaStatus" = 'RESOLVED'
WHERE "status" IN ('RESOLVED', 'CLOSED');

UPDATE "MaintenanceRequest"
SET "slaStatus" = 'RESOLUTION_PENDING'
WHERE "status" IN ('ACKNOWLEDGED', 'IN_PROGRESS')
  AND "slaResolutionBreachedAt" IS NULL;

CREATE INDEX "MaintenanceRequest_acknowledgementDeadlineAt_idx" ON "MaintenanceRequest"("acknowledgementDeadlineAt");
CREATE INDEX "MaintenanceRequest_resolutionDeadlineAt_idx" ON "MaintenanceRequest"("resolutionDeadlineAt");
CREATE INDEX "MaintenanceRequest_slaStatus_idx" ON "MaintenanceRequest"("slaStatus");
CREATE INDEX "MaintenanceRequest_acknowledgedById_idx" ON "MaintenanceRequest"("acknowledgedById");
CREATE INDEX "MaintenanceRequest_assignedTechnicianId_idx" ON "MaintenanceRequest"("assignedTechnicianId");

ALTER TABLE "MaintenanceRequest"
  ADD CONSTRAINT "MaintenanceRequest_acknowledgedById_fkey"
  FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MaintenanceRequest"
  ADD CONSTRAINT "MaintenanceRequest_assignedTechnicianId_fkey"
  FOREIGN KEY ("assignedTechnicianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
