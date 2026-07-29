-- Create phase-based accommodation inventory.
CREATE TABLE "Phase" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "phase_name" TEXT NOT NULL,
  "total_rooms" INTEGER NOT NULL DEFAULT 0,
  "available_rooms" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Phase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Phase_phase_name_key" ON "Phase"("phase_name");

ALTER TABLE "Phase"
  ADD CONSTRAINT "Phase_room_count_check"
  CHECK ("total_rooms" >= 0 AND "available_rooms" >= 0 AND "available_rooms" <= "total_rooms");

INSERT INTO "Phase" ("id", "phase_name", "total_rooms", "available_rooms", "updatedAt")
VALUES
  (gen_random_uuid(), 'Phase 1', 0, 0, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Phase 2', 0, 0, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Phase 3', 0, 0, CURRENT_TIMESTAMP);

-- Link existing applications to a phase so the new required relation can be enforced.
ALTER TABLE "Application" ADD COLUMN "phaseId" UUID;

UPDATE "Application"
SET "phaseId" = (SELECT "id" FROM "Phase" WHERE "phase_name" = 'Phase 1')
WHERE "phaseId" IS NULL;

ALTER TABLE "Application" ALTER COLUMN "phaseId" SET NOT NULL;

-- Remove room-based application allocation and inventory tracking.
ALTER TABLE "Application" DROP CONSTRAINT IF EXISTS "Application_allocatedRoomId_fkey";
ALTER TABLE "Application" DROP CONSTRAINT IF EXISTS "Application_roomTypeId_fkey";
DROP INDEX IF EXISTS "Application_roomTypeId_idx";
ALTER TABLE "Application" DROP COLUMN IF EXISTS "allocatedRoomId";
ALTER TABLE "Application" DROP COLUMN IF EXISTS "roomTypeId";

ALTER TABLE "Application"
  ADD CONSTRAINT "Application_phaseId_fkey"
  FOREIGN KEY ("phaseId") REFERENCES "Phase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Application_phaseId_idx" ON "Application"("phaseId");

DROP TABLE IF EXISTS "Room";
DROP TABLE IF EXISTS "RoomType";
DROP TYPE IF EXISTS "RoomStatus";
