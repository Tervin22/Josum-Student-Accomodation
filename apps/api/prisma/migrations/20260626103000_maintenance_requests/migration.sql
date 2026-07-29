CREATE TYPE "MaintenanceStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
CREATE TYPE "MaintenancePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "MaintenanceCategory" AS ENUM ('PLUMBING', 'ELECTRICAL', 'FURNITURE', 'CLEANING', 'INTERNET', 'SECURITY', 'OTHER');

CREATE TABLE "MaintenanceRequest" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "referenceCode" TEXT NOT NULL,
  "userId" UUID NOT NULL,
  "phaseId" UUID,
  "category" "MaintenanceCategory" NOT NULL DEFAULT 'OTHER',
  "priority" "MaintenancePriority" NOT NULL DEFAULT 'MEDIUM',
  "status" "MaintenanceStatus" NOT NULL DEFAULT 'OPEN',
  "location" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "resolutionNote" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolvedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaintenanceRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MaintenanceRequest_referenceCode_key" ON "MaintenanceRequest"("referenceCode");
CREATE INDEX "MaintenanceRequest_userId_idx" ON "MaintenanceRequest"("userId");
CREATE INDEX "MaintenanceRequest_phaseId_idx" ON "MaintenanceRequest"("phaseId");
CREATE INDEX "MaintenanceRequest_status_idx" ON "MaintenanceRequest"("status");
CREATE INDEX "MaintenanceRequest_priority_idx" ON "MaintenanceRequest"("priority");
CREATE INDEX "MaintenanceRequest_createdAt_idx" ON "MaintenanceRequest"("createdAt");

ALTER TABLE "MaintenanceRequest"
  ADD CONSTRAINT "MaintenanceRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MaintenanceRequest"
  ADD CONSTRAINT "MaintenanceRequest_phaseId_fkey"
  FOREIGN KEY ("phaseId") REFERENCES "Phase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MaintenanceRequest"
  ADD CONSTRAINT "MaintenanceRequest_resolvedById_fkey"
  FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
