# Temporary client testing

This branch deploys the five-residence portal to free Render services with a separate free PostgreSQL database. The production deployment template is retained as render.production.yaml.

The root render.yaml uses only free plans. It creates two native Node.js web services and PostgreSQL 18. Build and startup apply the existing migrations and catalogue seed; no local database or previous actor data is uploaded. Do not select an upgrade or add a payment method for this temporary test deployment.

## Test limitations

- The free PostgreSQL database expires 30 days after creation and has a 1 GB limit. Export test results before expiry.
- Idle web services sleep after 15 minutes. The first visit can take a minute or more to wake both services.
- Uploaded files use temporary local storage and can disappear on sleep, restart or deployment. Use sample documents only.
- Preview mode suppresses email delivery and records those messages as failed with an explanatory reason. It does not claim successful delivery. Password-reset email delivery and SMTP acceptance are outside this temporary test.
- The frontend shows a test notice and requests that search engines do not index it.

## Initial access

Create the first administrator with the preview installation token and temporarily enabled bootstrap. Disable bootstrap immediately afterwards. Give the client only the test account or role key required for their review. The preview database and role keys are independent of the local handover credentials.

Confirm the actual generated Render URLs after creation. API PUBLIC_APP_URL and WEB_ORIGIN must equal the frontend HTTPS origin. The frontend NEXT_PUBLIC_API_URL must equal the API HTTPS origin and is applied at build time.

Verify the frontend, /health/ready on the API, account registration/login and the key client workflows before sharing the final portal URL.

Official limits: https://render.com/docs/free
