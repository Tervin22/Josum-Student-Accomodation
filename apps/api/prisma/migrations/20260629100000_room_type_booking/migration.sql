-- Convert phase-based inventory into room-type-based booking inventory.
DO $$
BEGIN
  IF to_regclass('"Phase"') IS NOT NULL AND to_regclass('"RoomType"') IS NULL THEN
    ALTER TABLE "Phase" RENAME TO "RoomType";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'RoomType' AND column_name = 'phase_name'
  ) THEN
    ALTER TABLE "RoomType" RENAME COLUMN "phase_name" TO "room_type_name";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Phase_pkey') THEN
    ALTER TABLE "RoomType" RENAME CONSTRAINT "Phase_pkey" TO "RoomType_pkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Phase_room_count_check') THEN
    ALTER TABLE "RoomType" RENAME CONSTRAINT "Phase_room_count_check" TO "RoomType_room_count_check";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'Phase_phase_name_key') THEN
    ALTER INDEX "Phase_phase_name_key" RENAME TO "RoomType_room_type_name_key";
  END IF;
END $$;

UPDATE "RoomType"
SET "room_type_name" = 'Single Room'
WHERE "room_type_name" = 'Phase 1'
  AND NOT EXISTS (SELECT 1 FROM "RoomType" WHERE "room_type_name" = 'Single Room');

UPDATE "RoomType"
SET "room_type_name" = 'Sharing'
WHERE "room_type_name" = 'Phase 2'
  AND NOT EXISTS (SELECT 1 FROM "RoomType" WHERE "room_type_name" = 'Sharing');

UPDATE "RoomType"
SET "room_type_name" = 'Large Room'
WHERE "room_type_name" = 'Phase 3'
  AND NOT EXISTS (SELECT 1 FROM "RoomType" WHERE "room_type_name" = 'Large Room');

INSERT INTO "RoomType" ("id", "room_type_name", "total_rooms", "available_rooms", "updatedAt")
SELECT gen_random_uuid(), 'Single Room', 0, 0, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "RoomType" WHERE "room_type_name" = 'Single Room');

INSERT INTO "RoomType" ("id", "room_type_name", "total_rooms", "available_rooms", "updatedAt")
SELECT gen_random_uuid(), 'Sharing', 0, 0, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "RoomType" WHERE "room_type_name" = 'Sharing');

INSERT INTO "RoomType" ("id", "room_type_name", "total_rooms", "available_rooms", "updatedAt")
SELECT gen_random_uuid(), 'Large Room', 0, 0, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "RoomType" WHERE "room_type_name" = 'Large Room');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Application' AND column_name = 'phaseId'
  ) THEN
    ALTER TABLE "Application" RENAME COLUMN "phaseId" TO "roomTypeId";
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Application' AND column_name = 'preferredMoveInDate'
  ) THEN
    ALTER TABLE "Application" RENAME COLUMN "preferredMoveInDate" TO "dateOfOccupation";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'MaintenanceRequest' AND column_name = 'phaseId'
  ) THEN
    ALTER TABLE "MaintenanceRequest" RENAME COLUMN "phaseId" TO "roomTypeId";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Application_phaseId_fkey') THEN
    ALTER TABLE "Application" RENAME CONSTRAINT "Application_phaseId_fkey" TO "Application_roomTypeId_fkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MaintenanceRequest_phaseId_fkey') THEN
    ALTER TABLE "MaintenanceRequest" RENAME CONSTRAINT "MaintenanceRequest_phaseId_fkey" TO "MaintenanceRequest_roomTypeId_fkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'Application_phaseId_idx') THEN
    ALTER INDEX "Application_phaseId_idx" RENAME TO "Application_roomTypeId_idx";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'MaintenanceRequest_phaseId_idx') THEN
    ALTER INDEX "MaintenanceRequest_phaseId_idx" RENAME TO "MaintenanceRequest_roomTypeId_idx";
  END IF;
END $$;

ALTER TABLE "Application"
  ADD COLUMN IF NOT EXISTS "nationality" TEXT,
  ADD COLUMN IF NOT EXISTS "gender" TEXT,
  ADD COLUMN IF NOT EXISTS "postalCode" TEXT,
  ADD COLUMN IF NOT EXISTS "studentAdvisorDetails" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentTerm" TEXT,
  ADD COLUMN IF NOT EXISTS "guarantorFullName" TEXT,
  ADD COLUMN IF NOT EXISTS "guarantorIdPassport" TEXT,
  ADD COLUMN IF NOT EXISTS "guarantorCell" TEXT,
  ADD COLUMN IF NOT EXISTS "guarantorEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "guarantorAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "guarantorNationality" TEXT,
  ADD COLUMN IF NOT EXISTS "guarantorEmployer" TEXT,
  ADD COLUMN IF NOT EXISTS "guarantorWorkTel" TEXT,
  ADD COLUMN IF NOT EXISTS "nextOfKin1Name" TEXT,
  ADD COLUMN IF NOT EXISTS "nextOfKin1Relationship" TEXT,
  ADD COLUMN IF NOT EXISTS "nextOfKin1Cell" TEXT,
  ADD COLUMN IF NOT EXISTS "nextOfKin2Name" TEXT,
  ADD COLUMN IF NOT EXISTS "nextOfKin2Relationship" TEXT,
  ADD COLUMN IF NOT EXISTS "nextOfKin2Cell" TEXT,
  ADD COLUMN IF NOT EXISTS "nextOfKin3Name" TEXT,
  ADD COLUMN IF NOT EXISTS "nextOfKin3Relationship" TEXT,
  ADD COLUMN IF NOT EXISTS "nextOfKin3Cell" TEXT,
  ADD COLUMN IF NOT EXISTS "medicalDetails" TEXT,
  ADD COLUMN IF NOT EXISTS "termsAccepted" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Application_roomTypeId_idx" ON "Application"("roomTypeId");
CREATE INDEX IF NOT EXISTS "MaintenanceRequest_roomTypeId_idx" ON "MaintenanceRequest"("roomTypeId");
