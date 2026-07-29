CREATE TYPE "InspectionRating" AS ENUM (
  'GOOD',
  'FAIR',
  'POOR',
  'NOT_APPLICABLE'
);

CREATE TYPE "InspectionStatus" AS ENUM (
  'DRAFT',
  'COMPLETED',
  'FOLLOW_UP_REQUIRED',
  'CLOSED'
);

CREATE TYPE "InspectionSeverity" AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
);

CREATE TABLE "InspectionPeriod" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InspectionPeriod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Inspection" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "referenceCode" TEXT NOT NULL,
  "periodId" UUID NOT NULL,
  "residenceId" UUID NOT NULL,
  "roomId" UUID NOT NULL,
  "studentId" UUID,
  "occupantNames" TEXT,
  "inspectorId" UUID,
  "inspectionDate" TIMESTAMP(3) NOT NULL,
  "generalCleanliness" "InspectionRating" NOT NULL DEFAULT 'GOOD',
  "walls" "InspectionRating" NOT NULL DEFAULT 'GOOD',
  "doorsAndLocks" "InspectionRating" NOT NULL DEFAULT 'GOOD',
  "windows" "InspectionRating" NOT NULL DEFAULT 'GOOD',
  "flooring" "InspectionRating" NOT NULL DEFAULT 'GOOD',
  "ceiling" "InspectionRating" NOT NULL DEFAULT 'GOOD',
  "lighting" "InspectionRating" NOT NULL DEFAULT 'GOOD',
  "electricalSockets" "InspectionRating" NOT NULL DEFAULT 'GOOD',
  "plumbing" "InspectionRating" NOT NULL DEFAULT 'GOOD',
  "bathroomCondition" "InspectionRating" NOT NULL DEFAULT 'GOOD',
  "furnitureCondition" "InspectionRating" NOT NULL DEFAULT 'GOOD',
  "bedCondition" "InspectionRating" NOT NULL DEFAULT 'GOOD',
  "wardrobeCondition" "InspectionRating" NOT NULL DEFAULT 'GOOD',
  "appliances" "InspectionRating" NOT NULL DEFAULT 'NOT_APPLICABLE',
  "fireSafetyEquipment" "InspectionRating" NOT NULL DEFAULT 'GOOD',
  "damageIdentified" TEXT,
  "maintenanceRequired" BOOLEAN NOT NULL DEFAULT false,
  "severity" "InspectionSeverity" NOT NULL DEFAULT 'LOW',
  "comments" TEXT,
  "studentAcknowledgement" BOOLEAN NOT NULL DEFAULT false,
  "inspectorConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "studentConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
  "followUpDate" TIMESTAMP(3),
  "followUpActions" TEXT,
  "status" "InspectionStatus" NOT NULL DEFAULT 'DRAFT',
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InspectionAttachment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "inspectionId" UUID NOT NULL,
  "uploadedById" UUID,
  "originalName" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "checksum" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InspectionAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InspectionPeriod_name_year_key" ON "InspectionPeriod"("name", "year");
CREATE INDEX "InspectionPeriod_year_idx" ON "InspectionPeriod"("year");
CREATE INDEX "InspectionPeriod_isActive_idx" ON "InspectionPeriod"("isActive");

CREATE UNIQUE INDEX "Inspection_referenceCode_key" ON "Inspection"("referenceCode");
CREATE UNIQUE INDEX "Inspection_periodId_roomId_key" ON "Inspection"("periodId", "roomId");
CREATE INDEX "Inspection_periodId_idx" ON "Inspection"("periodId");
CREATE INDEX "Inspection_residenceId_idx" ON "Inspection"("residenceId");
CREATE INDEX "Inspection_roomId_idx" ON "Inspection"("roomId");
CREATE INDEX "Inspection_studentId_idx" ON "Inspection"("studentId");
CREATE INDEX "Inspection_inspectorId_idx" ON "Inspection"("inspectorId");
CREATE INDEX "Inspection_status_idx" ON "Inspection"("status");
CREATE INDEX "Inspection_inspectionDate_idx" ON "Inspection"("inspectionDate");
CREATE INDEX "Inspection_createdAt_idx" ON "Inspection"("createdAt");

CREATE UNIQUE INDEX "InspectionAttachment_storageKey_key" ON "InspectionAttachment"("storageKey");
CREATE INDEX "InspectionAttachment_inspectionId_idx" ON "InspectionAttachment"("inspectionId");
CREATE INDEX "InspectionAttachment_uploadedById_idx" ON "InspectionAttachment"("uploadedById");
CREATE INDEX "InspectionAttachment_createdAt_idx" ON "InspectionAttachment"("createdAt");

ALTER TABLE "Inspection"
  ADD CONSTRAINT "Inspection_periodId_fkey"
  FOREIGN KEY ("periodId") REFERENCES "InspectionPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Inspection"
  ADD CONSTRAINT "Inspection_residenceId_fkey"
  FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Inspection"
  ADD CONSTRAINT "Inspection_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "ResidenceRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Inspection"
  ADD CONSTRAINT "Inspection_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Inspection"
  ADD CONSTRAINT "Inspection_inspectorId_fkey"
  FOREIGN KEY ("inspectorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InspectionAttachment"
  ADD CONSTRAINT "InspectionAttachment_inspectionId_fkey"
  FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
