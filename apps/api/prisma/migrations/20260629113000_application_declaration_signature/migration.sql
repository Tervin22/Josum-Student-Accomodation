ALTER TABLE "Application"
  ADD COLUMN IF NOT EXISTS "declarationAccepted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "electronicSignatureName" TEXT,
  ADD COLUMN IF NOT EXISTS "electronicSignatureIdPassport" TEXT,
  ADD COLUMN IF NOT EXISTS "signedAt" TIMESTAMP(3);
