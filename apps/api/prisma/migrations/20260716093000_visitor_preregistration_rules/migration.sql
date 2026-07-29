CREATE TABLE "VisitorPreRegistration" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "residenceId" UUID,
  "roomId" UUID,
  "visitorName" TEXT NOT NULL,
  "visitorPhone" TEXT,
  "visitorIdNumber" TEXT,
  "relationship" TEXT NOT NULL,
  "expectedVisitDate" TIMESTAMP(3) NOT NULL,
  "expectedArrivalTime" TEXT NOT NULL,
  "vehicleRegistration" TEXT,
  "notes" TEXT,
  "termsAccepted" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VisitorPreRegistration_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "VisitorLog"
  ADD COLUMN "userId" UUID,
  ADD COLUMN "roomId" UUID,
  ADD COLUMN "preRegistrationId" UUID,
  ADD COLUMN "relationship" TEXT,
  ADD COLUMN "termsAccepted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "checkedOutById" UUID,
  ADD COLUMN "checkoutNotes" TEXT,
  ADD COLUMN "overrideReason" TEXT,
  ADD COLUMN "overrideById" UUID,
  ADD COLUMN "overrideAt" TIMESTAMP(3);

CREATE INDEX "VisitorPreRegistration_userId_idx" ON "VisitorPreRegistration"("userId");
CREATE INDEX "VisitorPreRegistration_residenceId_idx" ON "VisitorPreRegistration"("residenceId");
CREATE INDEX "VisitorPreRegistration_roomId_idx" ON "VisitorPreRegistration"("roomId");
CREATE INDEX "VisitorPreRegistration_status_idx" ON "VisitorPreRegistration"("status");
CREATE INDEX "VisitorPreRegistration_expectedVisitDate_idx" ON "VisitorPreRegistration"("expectedVisitDate");
CREATE INDEX "VisitorPreRegistration_createdAt_idx" ON "VisitorPreRegistration"("createdAt");

CREATE UNIQUE INDEX "VisitorLog_preRegistrationId_key" ON "VisitorLog"("preRegistrationId");
CREATE INDEX "VisitorLog_userId_idx" ON "VisitorLog"("userId");
CREATE INDEX "VisitorLog_roomId_idx" ON "VisitorLog"("roomId");
CREATE INDEX "VisitorLog_checkedOutById_idx" ON "VisitorLog"("checkedOutById");
CREATE INDEX "VisitorLog_overrideById_idx" ON "VisitorLog"("overrideById");

ALTER TABLE "VisitorPreRegistration"
  ADD CONSTRAINT "VisitorPreRegistration_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VisitorPreRegistration"
  ADD CONSTRAINT "VisitorPreRegistration_residenceId_fkey"
  FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VisitorPreRegistration"
  ADD CONSTRAINT "VisitorPreRegistration_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "ResidenceRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VisitorLog"
  ADD CONSTRAINT "VisitorLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VisitorLog"
  ADD CONSTRAINT "VisitorLog_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "ResidenceRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VisitorLog"
  ADD CONSTRAINT "VisitorLog_preRegistrationId_fkey"
  FOREIGN KEY ("preRegistrationId") REFERENCES "VisitorPreRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VisitorLog"
  ADD CONSTRAINT "VisitorLog_checkedOutById_fkey"
  FOREIGN KEY ("checkedOutById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VisitorLog"
  ADD CONSTRAINT "VisitorLog_overrideById_fkey"
  FOREIGN KEY ("overrideById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
