# Temporary client testing

This branch deploys the five-residence portal to free Render services with a separate free PostgreSQL database. The production deployment template is retained as render.production.yaml.

The root render.yaml uses only free plans. It defines two native Node.js web services in Oregon. An isolated logical PostgreSQL 18 database and dedicated login are provisioned inside the existing free nathi-db instance, because Render permits only one free Postgres instance per workspace. Set DATABASE_URL to that logical database's internal URL. Existing databases and applications are preserved. Startup applies the existing migrations and catalogue seed; no local database or previous actor data is uploaded. Do not select an upgrade or add a payment method for this temporary test deployment.

## Test limitations

- The existing free PostgreSQL instance expires on **18 November 2026** and has a shared 1 GB limit. Export test results before expiry.
- Idle web services sleep after 15 minutes. The first visit can take a minute or more to wake both services.
- Uploaded files use temporary local storage and can disappear on sleep, restart or deployment. Use sample documents only.
- Preview mode suppresses email delivery and records those messages as failed with an explanatory reason. It does not claim successful delivery. Password-reset email delivery and SMTP acceptance are outside this temporary test.
- The frontend shows a test notice and requests that search engines do not index it.

## Initial access

Create the first administrator through an isolated local API process connected to the preview database, with bootstrap temporarily enabled only for that local process. The public cloud service keeps bootstrap disabled. Give the client only the test account or role key required for their review. The preview database and role keys are independent of the local handover credentials.

Confirm the actual generated Render URLs after creation. API PUBLIC_APP_URL and WEB_ORIGIN must equal the frontend HTTPS origin. The frontend NEXT_PUBLIC_API_URL must equal the API HTTPS origin and is applied at build time.

Verify the frontend, /health/ready on the API, account registration/login and the key client workflows before sharing the final portal URL.

Official limits: https://render.com/docs/free
