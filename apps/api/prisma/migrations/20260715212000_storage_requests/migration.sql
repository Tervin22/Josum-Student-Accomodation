CREATE TYPE "StorageRequestStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'ITEMS_RECEIVED',
  'ITEMS_RELEASED',
  'CANCELLED'
);

CREATE TYPE "StorageFileType" AS ENUM (
  'FORM',
  'ITEM_IMAGE'
);

CREATE TABLE "StorageRequest" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "referenceCode" TEXT NOT NULL,
  "userId" UUID NOT NULL,
  "applicationId" UUID,
  "residenceId" UUID,
  "roomId" UUID,
  "status" "StorageRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
  "itemDescription" TEXT,
  "reviewNotes" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" UUID,
  "receivedAt" TIMESTAMP(3),
  "receivedById" UUID,
  "releasedAt" TIMESTAMP(3),
  "releasedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StorageRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StorageRequestFile" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "requestId" UUID NOT NULL,
  "uploadedById" UUID NOT NULL,
  "fileType" "StorageFileType" NOT NULL,
  "originalName" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "checksum" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StorageRequestFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StorageRequestStatusHistory" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "storageRequestId" UUID NOT NULL,
  "fromStatus" "StorageRequestStatus",
  "toStatus" "StorageRequestStatus" NOT NULL,
  "note" TEXT,
  "changedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StorageRequestStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StorageRequest_referenceCode_key" ON "StorageRequest"("referenceCode");
CREATE INDEX "StorageRequest_userId_idx" ON "StorageRequest"("userId");
CREATE INDEX "StorageRequest_applicationId_idx" ON "StorageRequest"("applicationId");
CREATE INDEX "StorageRequest_residenceId_idx" ON "StorageRequest"("residenceId");
CREATE INDEX "StorageRequest_roomId_idx" ON "StorageRequest"("roomId");
CREATE INDEX "StorageRequest_status_idx" ON "StorageRequest"("status");
CREATE INDEX "StorageRequest_submittedAt_idx" ON "StorageRequest"("submittedAt");
CREATE INDEX "StorageRequest_status_submittedAt_idx" ON "StorageRequest"("status", "submittedAt");

CREATE UNIQUE INDEX "StorageRequestFile_storageKey_key" ON "StorageRequestFile"("storageKey");
CREATE INDEX "StorageRequestFile_requestId_idx" ON "StorageRequestFile"("requestId");
CREATE INDEX "StorageRequestFile_uploadedById_idx" ON "StorageRequestFile"("uploadedById");
CREATE INDEX "StorageRequestFile_fileType_idx" ON "StorageRequestFile"("fileType");
CREATE INDEX "StorageRequestFile_createdAt_idx" ON "StorageRequestFile"("createdAt");

CREATE INDEX "StorageRequestStatusHistory_storageRequestId_idx" ON "StorageRequestStatusHistory"("storageRequestId");
CREATE INDEX "StorageRequestStatusHistory_changedById_idx" ON "StorageRequestStatusHistory"("changedById");
CREATE INDEX "StorageRequestStatusHistory_createdAt_idx" ON "StorageRequestStatusHistory"("createdAt");

ALTER TABLE "StorageRequest"
  ADD CONSTRAINT "StorageRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StorageRequest"
  ADD CONSTRAINT "StorageRequest_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StorageRequest"
  ADD CONSTRAINT "StorageRequest_residenceId_fkey"
  FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StorageRequest"
  ADD CONSTRAINT "StorageRequest_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "ResidenceRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StorageRequest"
  ADD CONSTRAINT "StorageRequest_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StorageRequest"
  ADD CONSTRAINT "StorageRequest_receivedById_fkey"
  FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StorageRequest"
  ADD CONSTRAINT "StorageRequest_releasedById_fkey"
  FOREIGN KEY ("releasedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StorageRequestFile"
  ADD CONSTRAINT "StorageRequestFile_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "StorageRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StorageRequestStatusHistory"
  ADD CONSTRAINT "StorageRequestStatusHistory_storageRequestId_fkey"
  FOREIGN KEY ("storageRequestId") REFERENCES "StorageRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StorageRequestStatusHistory"
  ADD CONSTRAINT "StorageRequestStatusHistory_changedById_fkey"
  FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
