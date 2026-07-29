CREATE TABLE "Communication" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "type" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "residenceId" UUID,
  "sentById" UUID,
  "recipientCount" INTEGER NOT NULL DEFAULT 0,
  "successCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Communication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Communication_type_idx" ON "Communication"("type");
CREATE INDEX "Communication_residenceId_idx" ON "Communication"("residenceId");
CREATE INDEX "Communication_sentById_idx" ON "Communication"("sentById");
CREATE INDEX "Communication_createdAt_idx" ON "Communication"("createdAt");

ALTER TABLE "Communication"
  ADD CONSTRAINT "Communication_residenceId_fkey"
  FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Communication"
  ADD CONSTRAINT "Communication_sentById_fkey"
  FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
