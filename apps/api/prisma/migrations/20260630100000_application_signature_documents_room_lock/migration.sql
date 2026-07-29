ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'APPLICANT_ID_PASSPORT';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'STUDENT_COLOR_ID_PHOTOS';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'STUDENT_ACCEPTANCE_LETTER';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'GUARANTOR_SUPPORTING_DOCUMENTS';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'MEDICAL_AID_CERTIFICATE';

ALTER TABLE "Application"
  ADD COLUMN IF NOT EXISTS "institutionName" TEXT,
  ADD COLUMN IF NOT EXISTS "courseName" TEXT,
  ADD COLUMN IF NOT EXISTS "signatureDataUrl" TEXT;

UPDATE "EmailTemplate"
SET "body" = $$Hello {{name}},

Your accommodation application {{referenceCode}} has been received, but no supporting documents have been uploaded yet.

Please sign in and upload the required documents so the application can be reviewed:

- Applicant's ID / Passport copy
- 2 x Student color ID Photos
- Student's Acceptance Letter
- Guarantor's ID / Passport copy, pay slip, 3 Months Bank statement, and proof of address
- Medical Aid Certificate valid until November 2024 (International students only)

Upload here: {{appUrl}}$$,
    "updatedAt" = NOW()
WHERE "key" = 'documents-required';
