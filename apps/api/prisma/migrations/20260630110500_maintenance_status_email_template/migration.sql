INSERT INTO "EmailTemplate" ("id", "key", "subject", "body", "enabled", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'maintenance-status-changed',
  '{{maintenanceStatusSubject}}',
  $$Hello {{name}},

{{maintenanceOpeningMessage}}

Request reference: {{referenceCode}}
Current stage: {{toStatus}}
Issue: {{title}}
Acknowledged / updated by: {{administratorName}}

{{maintenanceDetailMessage}}{{resolutionNoteBlock}}

You can sign in to view the request here: {{appUrl}}

Kind regards,
{{appName}}$$,
  true,
  NOW(),
  NOW()
)
ON CONFLICT ("key") DO UPDATE
SET "subject" = EXCLUDED."subject",
    "body" = EXCLUDED."body",
    "enabled" = true,
    "updatedAt" = NOW();
