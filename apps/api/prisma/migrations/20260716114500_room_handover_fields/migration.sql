ALTER TABLE "Inspection"
  ADD COLUMN "studentFullName" TEXT,
  ADD COLUMN "studentNumber" TEXT,
  ADD COLUMN "contactNumber" TEXT,
  ADD COLUMN "emailAddress" TEXT,
  ADD COLUMN "keyNumberIssued" TEXT,
  ADD COLUMN "checkInDate" TIMESTAMP(3),
  ADD COLUMN "checkOutDate" TIMESTAMP(3),
  ADD COLUMN "certifiedIdCopy" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "proofOfRegistration" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "academicRecord" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "proofOfFunding" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "signedLeaseAgreement" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "moveInConditions" JSONB,
  ADD COLUMN "moveOutConditions" JSONB,
  ADD COLUMN "itemsBroughtIn" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "studentDeclaration" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "studentSignature" TEXT,
  ADD COLUMN "studentSignatureDate" TIMESTAMP(3),
  ADD COLUMN "managementSignatureIn" TEXT,
  ADD COLUMN "managementSignatureOut" TEXT,
  ADD COLUMN "tenantSignatureIn" TEXT,
  ADD COLUMN "tenantSignatureOut" TEXT;

CREATE INDEX "Inspection_studentNumber_idx" ON "Inspection"("studentNumber");
CREATE INDEX "Inspection_checkInDate_idx" ON "Inspection"("checkInDate");
CREATE INDEX "Inspection_checkOutDate_idx" ON "Inspection"("checkOutDate");
