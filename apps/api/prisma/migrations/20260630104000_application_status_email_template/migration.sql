UPDATE "EmailTemplate"
SET "subject" = '{{statusSubject}}',
    "body" = $$Hello {{name}},

{{openingMessage}}

Application reference: {{referenceCode}}
Current status: {{toStatus}}
Residence: {{residenceName}}

{{detailMessage}}

{{nextStepMessage}}{{studentNoteBlock}}

You can sign in to view your application here: {{appUrl}}

Kind regards,
{{residenceName}}$$,
    "updatedAt" = NOW()
WHERE "key" = 'application-status-changed';
