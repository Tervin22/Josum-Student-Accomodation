CREATE TYPE "ResidenceRoomStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'OCCUPIED', 'MAINTENANCE');

CREATE TABLE "ResidenceRoom" (
  "id" UUID NOT NULL,
  "residenceId" UUID NOT NULL,
  "roomNumber" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "genderAllocation" TEXT NOT NULL,
  "roomTypeName" TEXT NOT NULL,
  "capacity" INTEGER NOT NULL DEFAULT 1,
  "status" "ResidenceRoomStatus" NOT NULL DEFAULT 'AVAILABLE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ResidenceRoom_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ResidenceRoom_capacity_check" CHECK ("capacity" > 0)
);

CREATE UNIQUE INDEX "ResidenceRoom_residenceId_roomNumber_key"
  ON "ResidenceRoom"("residenceId", "roomNumber");
CREATE INDEX "ResidenceRoom_residenceId_status_idx"
  ON "ResidenceRoom"("residenceId", "status");

ALTER TABLE "ResidenceRoom"
  ADD CONSTRAINT "ResidenceRoom_residenceId_fkey"
  FOREIGN KEY ("residenceId") REFERENCES "Residence"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ResidenceRoom" (
  "id",
  "residenceId",
  "roomNumber",
  "name",
  "genderAllocation",
  "roomTypeName",
  "capacity"
)
SELECT
  md5(residence."id"::text || '-' || room_number::text)::uuid,
  residence."id",
  room_number,
  'Room ' || room_number,
  CASE
    WHEN residence."name" = 'Josum 2' THEN 'Female'
    WHEN room_number <= 50 THEN 'Female'
    ELSE 'Male'
  END,
  CASE
    WHEN residence."name" = 'Josum 1' AND room_number = 7 THEN 'Sharing Room'
    ELSE 'Single Room'
  END,
  CASE
    WHEN residence."name" = 'Josum 1' AND room_number = 7 THEN 2
    ELSE 1
  END
FROM "Residence" residence
CROSS JOIN LATERAL generate_series(1, residence."totalRooms") room_number;

ALTER TABLE "Application"
  ADD COLUMN "roomId" UUID,
  ADD COLUMN "isNwuStudent" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "studyYear" TEXT,
  ADD COLUMN "studySemester" TEXT,
  ADD COLUMN "returningStudent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "applicantFirstName" TEXT,
  ADD COLUMN "applicantLastName" TEXT,
  ADD COLUMN "studentIdNumber" TEXT,
  ADD COLUMN "studentNumber" TEXT,
  ADD COLUMN "studentPhone" TEXT,
  ADD COLUMN "fundingReference" TEXT,
  ADD COLUMN "hasMedicalConditions" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "additionalInformation" TEXT;

UPDATE "Application" application
SET
  "studyYear" = COALESCE(profile."yearOfStudy"::text, 'Not captured'),
  "studySemester" = 'Not captured',
  "applicantFirstName" = application_user."firstName",
  "applicantLastName" = application_user."lastName",
  "studentIdNumber" = COALESCE(profile."idNumber", 'Not captured'),
  "studentNumber" = COALESCE(profile."studentNumber", 'Not captured'),
  "studentPhone" = COALESCE(application_user."phone", 'Not captured')
FROM "User" application_user
LEFT JOIN "StudentProfile" profile ON profile."userId" = application_user."id"
WHERE application."userId" = application_user."id";

WITH ranked_approved AS (
  SELECT
    application."id",
    application."residenceId",
    application."gender",
    ROW_NUMBER() OVER (
      PARTITION BY application."residenceId", application."gender"
      ORDER BY application."approvedAt" NULLS LAST, application."createdAt"
    ) AS gender_rank
  FROM "Application" application
  WHERE application."status" = 'APPROVED'
),
room_assignments AS (
  SELECT
    ranked."id" AS application_id,
    room."id" AS room_id
  FROM ranked_approved ranked
  JOIN "Residence" residence ON residence."id" = ranked."residenceId"
  JOIN "ResidenceRoom" room
    ON room."residenceId" = ranked."residenceId"
    AND room."roomNumber" = CASE
      WHEN residence."name" = 'Josum 1' AND ranked."gender" = 'Male' THEN 50 + ranked.gender_rank
      ELSE ranked.gender_rank
    END
)
UPDATE "Application" application
SET "roomId" = room_assignments.room_id
FROM room_assignments
WHERE application."id" = room_assignments.application_id;

UPDATE "ResidenceRoom" room
SET "status" = 'OCCUPIED'
WHERE EXISTS (
  SELECT 1
  FROM "Application" application
  WHERE application."roomId" = room."id"
    AND application."status" = 'APPROVED'
);

ALTER TABLE "Application"
  ALTER COLUMN "studyYear" SET NOT NULL,
  ALTER COLUMN "studySemester" SET NOT NULL,
  ALTER COLUMN "applicantFirstName" SET NOT NULL,
  ALTER COLUMN "applicantLastName" SET NOT NULL,
  ALTER COLUMN "studentIdNumber" SET NOT NULL,
  ALTER COLUMN "studentNumber" SET NOT NULL,
  ALTER COLUMN "studentPhone" SET NOT NULL;

CREATE INDEX "Application_roomId_idx" ON "Application"("roomId");
ALTER TABLE "Application"
  ADD CONSTRAINT "Application_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "ResidenceRoom"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
