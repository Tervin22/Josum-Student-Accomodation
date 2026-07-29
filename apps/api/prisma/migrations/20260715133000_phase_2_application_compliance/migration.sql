ALTER TABLE "StudentProfile"
  ADD COLUMN "profileImageStorageKey" TEXT,
  ADD COLUMN "profileImageOriginalName" TEXT,
  ADD COLUMN "profileImageMimeType" TEXT,
  ADD COLUMN "profileImageSize" INTEGER,
  ADD COLUMN "profileImageChecksum" TEXT,
  ADD COLUMN "profileImageUploadedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "StudentProfile_profileImageStorageKey_key" ON "StudentProfile"("profileImageStorageKey");

ALTER TABLE "Application"
  ADD COLUMN "applicantCategory" TEXT NOT NULL DEFAULT 'NEW_STUDENT',
  ADD COLUMN "academicRegistrationStatus" TEXT,
  ADD COLUMN "approvalExpiresAt" TIMESTAMP(3),
  ADD COLUMN "acceptedAt" TIMESTAMP(3),
  ADD COLUMN "documentsSatisfiedAt" TIMESTAMP(3);

CREATE INDEX "Application_approvalExpiresAt_idx" ON "Application"("approvalExpiresAt");
CREATE INDEX "Application_acceptedAt_idx" ON "Application"("acceptedAt");
