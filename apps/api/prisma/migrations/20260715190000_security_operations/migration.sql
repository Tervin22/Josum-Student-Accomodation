CREATE TABLE "VisitorLog" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "visitorName" TEXT NOT NULL,
  "visitorPhone" TEXT,
  "visitorIdNumber" TEXT,
  "residentName" TEXT,
  "residenceId" UUID,
  "purpose" TEXT,
  "vehicleRegistration" TEXT,
  "notes" TEXT,
  "recordedById" UUID,
  "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "checkedOutAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VisitorLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VisitorLog_residenceId_idx" ON "VisitorLog"("residenceId");
CREATE INDEX "VisitorLog_recordedById_idx" ON "VisitorLog"("recordedById");
CREATE INDEX "VisitorLog_checkedInAt_idx" ON "VisitorLog"("checkedInAt");
CREATE INDEX "VisitorLog_checkedOutAt_idx" ON "VisitorLog"("checkedOutAt");

CREATE TABLE "IncidentReport" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "referenceCode" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'LOW',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "residenceId" UUID,
  "location" TEXT,
  "reportedById" UUID,
  "resolutionNote" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "IncidentReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IncidentReport_referenceCode_key" ON "IncidentReport"("referenceCode");
CREATE INDEX "IncidentReport_status_idx" ON "IncidentReport"("status");
CREATE INDEX "IncidentReport_severity_idx" ON "IncidentReport"("severity");
CREATE INDEX "IncidentReport_residenceId_idx" ON "IncidentReport"("residenceId");
CREATE INDEX "IncidentReport_reportedById_idx" ON "IncidentReport"("reportedById");
CREATE INDEX "IncidentReport_createdAt_idx" ON "IncidentReport"("createdAt");

ALTER TABLE "VisitorLog"
  ADD CONSTRAINT "VisitorLog_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "VisitorLog_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IncidentReport"
  ADD CONSTRAINT "IncidentReport_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "IncidentReport_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
