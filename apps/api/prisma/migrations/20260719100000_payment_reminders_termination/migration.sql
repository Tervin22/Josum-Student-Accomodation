CREATE TYPE "StayStatus" AS ENUM ('ACTIVE', 'TERMINATED');

CREATE TYPE "PaymentReminderStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TYPE "RegistrationBlockIdentifierType" AS ENUM ('EMAIL', 'ID_NUMBER', 'STUDENT_NUMBER');

ALTER TABLE "Application"
  ADD COLUMN "stayStatus" "StayStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "terminatedAt" TIMESTAMP(3),
  ADD COLUMN "terminatedById" UUID,
  ADD COLUMN "terminationReason" TEXT;

CREATE TABLE "PaymentReminder" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "applicationId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "periodYear" INTEGER NOT NULL,
  "periodMonth" INTEGER NOT NULL,
  "amountCents" INTEGER NOT NULL DEFAULT 510000,
  "status" "PaymentReminderStatus" NOT NULL DEFAULT 'PENDING',
  "recipient" TEXT NOT NULL,
  "emailLogId" UUID,
  "error" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PaymentReminder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudentRegistrationBlock" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "identifierType" "RegistrationBlockIdentifierType" NOT NULL,
  "identifierNormalized" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "reason" TEXT,
  "sourceUserId" UUID,
  "applicationId" UUID,
  "blockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "blockedById" UUID,
  "whitelistedAt" TIMESTAMP(3),
  "whitelistedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StudentRegistrationBlock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Application_stayStatus_idx" ON "Application"("stayStatus");
CREATE INDEX "Application_terminatedAt_idx" ON "Application"("terminatedAt");
CREATE INDEX "Application_status_acceptedAt_roomId_idx" ON "Application"("status", "acceptedAt", "roomId");

CREATE UNIQUE INDEX "PaymentReminder_applicationId_periodYear_periodMonth_key"
  ON "PaymentReminder"("applicationId", "periodYear", "periodMonth");
CREATE INDEX "PaymentReminder_userId_idx" ON "PaymentReminder"("userId");
CREATE INDEX "PaymentReminder_periodYear_periodMonth_idx" ON "PaymentReminder"("periodYear", "periodMonth");
CREATE INDEX "PaymentReminder_status_idx" ON "PaymentReminder"("status");
CREATE INDEX "PaymentReminder_createdAt_idx" ON "PaymentReminder"("createdAt");

CREATE UNIQUE INDEX "StudentRegistrationBlock_identifierType_identifierNormalized_key"
  ON "StudentRegistrationBlock"("identifierType", "identifierNormalized");
CREATE INDEX "StudentRegistrationBlock_sourceUserId_idx" ON "StudentRegistrationBlock"("sourceUserId");
CREATE INDEX "StudentRegistrationBlock_applicationId_idx" ON "StudentRegistrationBlock"("applicationId");
CREATE INDEX "StudentRegistrationBlock_active_idx" ON "StudentRegistrationBlock"("active");
CREATE INDEX "StudentRegistrationBlock_blockedAt_idx" ON "StudentRegistrationBlock"("blockedAt");
CREATE INDEX "StudentRegistrationBlock_whitelistedAt_idx" ON "StudentRegistrationBlock"("whitelistedAt");

ALTER TABLE "Application"
  ADD CONSTRAINT "Application_terminatedById_fkey"
  FOREIGN KEY ("terminatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentReminder"
  ADD CONSTRAINT "PaymentReminder_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentReminder"
  ADD CONSTRAINT "PaymentReminder_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentRegistrationBlock"
  ADD CONSTRAINT "StudentRegistrationBlock_sourceUserId_fkey"
  FOREIGN KEY ("sourceUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StudentRegistrationBlock"
  ADD CONSTRAINT "StudentRegistrationBlock_blockedById_fkey"
  FOREIGN KEY ("blockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StudentRegistrationBlock"
  ADD CONSTRAINT "StudentRegistrationBlock_whitelistedById_fkey"
  FOREIGN KEY ("whitelistedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
