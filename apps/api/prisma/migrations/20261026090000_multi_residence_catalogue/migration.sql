ALTER TABLE "Residence"
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "acceptingApplications" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "advertisedCapacity" INTEGER,
  ADD COLUMN "maleCapacity" INTEGER,
  ADD COLUMN "femaleCapacity" INTEGER,
  ADD COLUMN "allowedGenders" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "allowedInstitutions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "websiteUrl" TEXT,
  ADD COLUMN "applicationUrl" TEXT,
  ADD COLUMN "applicationEmail" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "logoUrl" TEXT,
  ADD COLUMN "imageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "monthlyRentCents" INTEGER;
ALTER TABLE "Residence" ALTER COLUMN "distanceToNWU" DROP NOT NULL;
ALTER TABLE "Residence" ALTER COLUMN "distanceToShoppingCentre" DROP NOT NULL;
CREATE UNIQUE INDEX "Residence_slug_key" ON "Residence"("slug");
ALTER TABLE "Residence" ADD CONSTRAINT "Residence_published_capacity_check" CHECK (
  ("advertisedCapacity" IS NULL OR "advertisedCapacity" >= 0) AND
  ("maleCapacity" IS NULL OR "maleCapacity" >= 0) AND
  ("femaleCapacity" IS NULL OR "femaleCapacity" >= 0) AND
  ("monthlyRentCents" IS NULL OR "monthlyRentCents" > 0)
);
ALTER TABLE "RoomType" ADD COLUMN "displayName" TEXT, ADD COLUMN "residenceId" UUID;
ALTER TABLE "RoomType" ADD CONSTRAINT "RoomType_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "RoomType_residenceId_idx" ON "RoomType"("residenceId");
ALTER TABLE "Application" ADD COLUMN "hasChronicMedication" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "chronicMedicationDetails" TEXT, ADD COLUMN "guardianRelationship" TEXT;
-- Preserve historical accounts, applications, files and room allocations.
UPDATE "Residence" SET "active" = false, "acceptingApplications" = false
WHERE "name" IN ('Josum 1', 'Josum 2', 'Eduloft Centurion');
