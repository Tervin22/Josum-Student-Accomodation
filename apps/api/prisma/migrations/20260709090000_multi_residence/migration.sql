CREATE TABLE "Residence" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "residenceType" TEXT NOT NULL,
  "totalRooms" INTEGER NOT NULL,
  "availableRooms" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "facilities" TEXT[] NOT NULL,
  "amenities" TEXT[] NOT NULL,
  "distanceToNWU" DOUBLE PRECISION NOT NULL,
  "distanceToShoppingCentre" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Residence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Residence_room_capacity_check" CHECK (
    "totalRooms" >= 0
    AND "availableRooms" >= 0
    AND "availableRooms" <= "totalRooms"
  )
);

CREATE UNIQUE INDEX "Residence_name_key" ON "Residence"("name");
CREATE INDEX "Residence_name_idx" ON "Residence"("name");
CREATE INDEX "Residence_availableRooms_idx" ON "Residence"("availableRooms");

INSERT INTO "Residence" (
  "id",
  "name",
  "address",
  "residenceType",
  "totalRooms",
  "availableRooms",
  "description",
  "facilities",
  "amenities",
  "distanceToNWU",
  "distanceToShoppingCentre"
)
VALUES
(
  '11111111-1111-4111-8111-111111111101',
  'Josum 1',
  '50 Cassandra Avenue, Bedworth Park, Vereeniging',
  'Mixed - boys and girls',
  78,
  78,
  'A welcoming mixed residence with furnished single rooms, dedicated study areas, communal living spaces, and reliable support services.',
  ARRAY['4 communal bathrooms', '3 communal kitchens', '2 TV rooms', '1 laundry room', '1 study room'],
  ARRAY['Backup power supply', 'Backup power for Wi-Fi', 'Fully equipped gas stoves', 'Cleaning and caretaking staff', 'Complimentary shuttle service for residents', 'Study lounges and quiet areas', 'Backup water supply', 'Unlimited hot water with gas-powered geysers', 'On-site laundry facilities', 'Reliable 24-hour security', 'Fully furnished rooms', 'Recreational spaces', 'Regular social events and activities'],
  3.6,
  0.6
),
(
  '11111111-1111-4111-8111-111111111102',
  'Josum 2',
  '3 Ganymede Avenue, Bedworth Park, Vereeniging',
  'Girls only',
  120,
  120,
  'A secure girls-only residence with furnished single rooms, generous shared facilities, quiet study areas, and a multipurpose community space.',
  ARRAY['4 communal bathrooms', '4 communal kitchens', '2 TV rooms', '1 laundry room', '1 study room', '1 multipurpose room'],
  ARRAY['Backup power supply', 'Backup power for Wi-Fi', 'Fully equipped gas stoves', 'Cleaning and caretaking staff', 'Complimentary shuttle service for residents', 'Study lounges and quiet areas', 'Backup water supply', 'Unlimited hot water with gas-powered geysers', 'On-site laundry facilities', 'Reliable 24-hour security', 'Fully furnished rooms', 'Recreational spaces', 'Regular social events and activities'],
  3.1,
  0.95
);

ALTER TABLE "Application" ADD COLUMN "residenceId" UUID;

UPDATE "Application"
SET "residenceId" = '11111111-1111-4111-8111-111111111101'
WHERE "residenceId" IS NULL;

UPDATE "Residence"
SET "availableRooms" = GREATEST(
  "totalRooms" - (
    SELECT COUNT(*)::INTEGER
    FROM "Application"
    WHERE "Application"."residenceId" = "Residence"."id"
      AND "Application"."status" = 'APPROVED'
  ),
  0
);

ALTER TABLE "Application" ALTER COLUMN "residenceId" SET NOT NULL;
CREATE INDEX "Application_residenceId_idx" ON "Application"("residenceId");
ALTER TABLE "Application"
  ADD CONSTRAINT "Application_residenceId_fkey"
  FOREIGN KEY ("residenceId") REFERENCES "Residence"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE "EmailTemplate"
SET
  "body" = 'Hello {{name}},

{{openingMessage}}

Application reference: {{referenceCode}}
Current status: {{toStatus}}
Residence: {{residenceName}}
Address: {{residenceAddress}}

{{detailMessage}}

{{nextStepMessage}}{{studentNoteBlock}}

You can sign in to view your application here: {{appUrl}}

Kind regards,
{{appName}}',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'application-status-changed';
