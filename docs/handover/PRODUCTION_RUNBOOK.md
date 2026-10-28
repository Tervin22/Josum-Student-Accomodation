# Production Deployment And Operations

Release date: 28 October 2026. No production domain, hosting account or support company has been appointed. These instructions are a deployment runbook, not evidence that a public deployment has occurred. See `04_Verification/RELEASE_STATUS.md` in the handover pack for tests actually completed.

## Architecture And Ownership

The browser connects over HTTPS to a Next.js web service and a separate NestJS API. The API connects to private PostgreSQL, private document storage and an authenticated SMTP provider. Only the API receives database, SMTP, signing and storage credentials. `NEXT_PUBLIC_*` values are public build-time settings and must never contain secrets.

Keep the existing monorepo: `apps/web` is the frontend, `apps/api/src` is the backend and `apps/api/prisma` is the database source. Moving folders independently breaks workspace resolution and Docker paths. Use Node 22 LTS or a compatible newer supported LTS and the exact pnpm version in `packageManager`.

The client must own the repository, domain registrar, cloud billing, DNS, SMTP account, storage bucket, recovery material and backup accounts. Give its support company delegated access with MFA rather than transferring personal accounts. Walter Shingube does not provide ongoing hosting or support under the source-code sale. Future changes require a separate signed scope and fee.

## Local Installation On Windows

Open PowerShell in `01_Application`, not `C:\Windows\System32`. Install Node and PostgreSQL 18 first, or use Docker Desktop with Linux containers for the development stack.

```powershell
Get-Location
Test-Path package.json
corepack enable
corepack pnpm install --frozen-lockfile
node scripts/create-environment.mjs local
```

Open the newly generated private `.env.local`. Replace `DATABASE_URL` with a working connection to an empty database and a role permitted to create its schema. The local template does not create that PostgreSQL role or database. On an existing installation, do not overwrite its private environment. Generated keys are not the keys in the confidential current-installation annex.

The local template expects a development SMTP capture service on port 1025. For example, start Mailpit with Docker, or configure your approved SMTP provider. No message reaches a real inbox through Mailpit.

```powershell
corepack pnpm --filter @josum/api prisma:generate
corepack pnpm --filter @josum/api prisma:migrate:deploy
corepack pnpm --filter @josum/api prisma:seed
corepack pnpm --filter @josum/api build
node scripts/verify-starter-database.mjs
corepack pnpm dev
```

`verify-starter-database` needs `DATABASE_URL` exported into the shell; use `node --env-file=.env.local scripts/verify-starter-database.mjs` on a new local installation. It intentionally fails after accounts or rooms have been added. Browse `http://localhost:3000` and development API docs at `http://localhost:4000/docs`.

For the complete development Docker stack instead, run `node scripts/create-environment.mjs docker`, configure private `.env`, then `docker compose up --build`. PostgreSQL 18 uses a new named volume. Never mount a PostgreSQL 16/17 data directory directly into an 18 container. Migrate old databases using tested dump/restore or an approved major-version upgrade procedure. API startup applies migrations and seeds the catalogue.

## Recommended Managed Deployment

A paid Render web/API pair and paid PostgreSQL are a practical managed baseline for a small initial deployment. `render.yaml` defines two Docker services and PostgreSQL 18 in Frankfurt. It does not create a domain, object-storage bucket, SMTP provider, client support contract or privacy compliance programme. Obtain a provider quote for compute, database, backups, storage, email, network traffic, domain and taxes; none is included in R8,500.

Render's listed regions do not include South Africa. Frankfurt processing requires the client's cross-border assessment and appropriate operator arrangements under POPIA section 72. If South African infrastructure is required, appoint a qualified company to deploy the supplied AWS ECS/RDS/S3 templates in Cape Town (`af-south-1`). The AWS material is an advanced alternative, not an automatically provisioned or live-tested environment. Enable that region and verify service availability and costs first.

1. Create client-owned accounts with MFA. Create a private repository from `01_Application`; do not import the confidential package or `.env` files. Require review and green quality checks before deployment. AWS deployment is manual only and must remain gated by the GitHub `production` environment.
2. Create a private versioned object-storage bucket, block public access, enable encryption and grant the API only the required bucket/object actions. Do not grant public read access to identity, medical, inspection or financial documents. Establish retention and deletion policies with the client. IAM roles are preferred on AWS; scoped credentials are needed on Render.
3. Obtain an authenticated transactional SMTP service. Verify a client-owned sender domain, publish provider-required SPF, DKIM and DMARC DNS records, and configure bounces and suppression monitoring. Port 587 uses `SMTP_SECURE=false` with enforced STARTTLS; use `true` only for provider-supported implicit TLS such as port 465. Never disable certificate verification.
4. Import the Render Blueprint. Select the paid plans and confirm Frankfurt processing before creating resources. PostgreSQL has `ipAllowList: []`, so use internal service connections; grant time-limited external access only for an approved administrative task.
5. Populate every required environment field in the provider secret manager. For AWS S3, use its HTTPS regional endpoint if the Blueprint requires an endpoint field; for other S3-compatible providers follow their endpoint/path-style requirements. All JWT, recovery, bootstrap and staff keys must be different and at least 32 characters. Do not copy current local credentials to production.
6. Assign the frontend's final HTTPS address to API `PUBLIC_APP_URL` and exact browser origin to `WEB_ORIGIN`. Set frontend `NEXT_PUBLIC_API_URL` to the final public API HTTPS address. Render initially derives that value from the API service URL. After adding a custom API domain, replace it and rebuild the frontend. A restart alone cannot change a value already embedded in browser JavaScript.
7. Deploy one API replica. It applies `prisma migrate deploy` then the idempotent catalogue seed before serving traffic. Multiple replicas need a separately designed background-job coordination strategy; do not scale the scheduler horizontally without it. Store uploads in private S3, never on the ephemeral web container filesystem.
8. Check API `/health/live` and `/health/ready` and web `/health`. Readiness checks database access, not complete email/storage readiness. Review logs for configuration, migrations and startup errors without publishing secrets or student records.
9. Register the real domain in the client's name, configure DNS and managed TLS for web and API, and verify HTTPS redirects and certificate renewal. Prevent direct public access to backend container ports behind a reverse proxy. Update origins, sender links and frontend builds to match final domains.
10. Temporarily set `ENABLE_ADMIN_BOOTSTRAP=true` on the API with its unique installation token, deploy, visit `/login?portal=admin&bootstrap=1`, and create the client's administrator. Test login, then set it back to `false`, remove/rotate the installation token and redeploy. The API also prevents a second initial administrator after the first is created.
11. Have staff create their own accounts using Staff Login and only their appropriate role key. Students choose a residence and register without staff keys. Do not distribute JWT secrets, recovery keys or database passwords to ordinary staff. Replace shared registration keys after onboarding or suspected disclosure.
12. Complete the production acceptance checklist below and obtain signed acceptance. Keep a private record of deployed image identifiers, schema migration state, domain, incident contacts and backup evidence.

## Self Managed Container Alternative

`docker-compose.prod.yml` runs web/API behind Caddy with managed TLS; it does not provision PostgreSQL, S3 or SMTP. Use a supported Linux server, Docker, firewall and a competent operating company. Point real `PORTAL_HOST` and `API_HOST` DNS names at it before requesting certificates. Inbound application traffic should reach only 80/443. SSH must be restricted and monitored.

```powershell
node scripts/create-environment.mjs production
# Complete every provider and domain setting in the private file first.
corepack pnpm --filter @josum/api build
node scripts/check-production-env.mjs .env.production
docker compose --env-file .env.production -f docker-compose.prod.yml config --quiet
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

Do not run `docker compose config` without `--quiet` in public CI logs: expanded configuration can expose credentials. The preflight checks structure, not DNS, access policy, deliverability or suitability of the chosen host. Build and scan both Linux images in the provider's CI before launch if local Docker is unavailable. Pin approved image digests after testing and schedule base-image updates.

## Database Installation And Restoration

Preferred new installation: apply the complete migration history and run the catalogue seed. Never use `prisma migrate dev`, `migrate reset`, factory reset or the legacy reset script on production. Historical migrations remain unchanged to preserve checksums; the latest catalogue cleanup removes only unused known archived catalogue records. Existing operational references prevent their removal.

Alternative new installation: restore `02_Database/clean-starter.sql` into an empty PostgreSQL 18 database, using `psql -X -v ON_ERROR_STOP=1 -f clean-starter.sql`. It includes schema, migration history, five residences, five scoped categories and roles, with no accounts or numbered rooms. Afterwards run `prisma migrate status`, then `prisma migrate deploy` for later releases and the seed. Do not apply the old migrations as if the restored database had no migration history.

`schema-only.sql` is a reference/disaster-recovery aid, not a complete installation: it has no catalogue, roles or migration-history rows. Prefer migrations or the complete clean starter. Dumps contain no ownership or ACL instructions; a DBA must assign least-privilege production roles. The current local username/database are continuity details only, not a requirement to reuse that role on a managed host.

Back up before each release and at least daily according to the agreed recovery objectives. Use PostgreSQL 18 `pg_dump` for an 18 server, provider point-in-time recovery where available, encrypted offline/off-account copies and versioned document storage. Database backups do not include S3 objects or private environment secrets. Record access and deletion rules for all three.

Use environment-based PostgreSQL authentication or a protected password file, not passwords in command arguments, public logs or a connection URI pasted into a ticket. A DBA can export `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `PGSSLMODE=verify-full` and the required CA path privately, then run:

```text
pg_dump -Fc --no-owner --no-acl --file residence-backup.dump
pg_restore --list residence-backup.dump
pg_restore --no-owner --no-acl --exit-on-error --dbname EMPTY_RESTORE_DATABASE residence-backup.dump
```

Restore to an isolated empty database, verify row counts, migrations, representative documents and account access, and measure recovery time before launch. Do not restore over the active production database to test backups. Proposed objectives for client approval: no more than 24 hours of data loss and recovery within one working day; these are not contractual guarantees or verified production measurements.

## Operational Administration

Management enters confirmed numbered rooms in Administration > Rooms or Manager Dashboard > Residence Occupancy. Each slot has a residence, its scoped category, a number and a permitted gender. Same numbers may exist at different residences; duplicates within a residence are rejected. Website capacity does not prepopulate slots. There is no bed-level shared-room model in this release.

Review applications, supporting documents and signatures before offering a same-residence compatible available slot. Approval reserves; student acceptance occupies; expiry, cancellation and termination release through the application workflow. Do not bypass allocation logic by directly updating room status in SQL. Staff roles are global across locations; use role minimisation and audit review rather than representing the system as property-isolated tenancy.

New residence rents are unset. A DBA must update `Residence.monthlyRentCents` in a controlled transaction using confirmed integer cents and a verified residence ID. Obtain a dual-approved tariff schedule and check the mail preview before any payment reminders. A dedicated tariff-management screen and bank reconciliation/payment gateway are not included. Never reuse the former Josum banking instructions without explicit verification.

Monitor failed `EmailLog` records, failed reminders, HTTP error rates, database/storage growth, disk use, object access, backups, SMTP bounces and expiring certificates. Existing email sending is synchronous/best-effort; a transactional durable queue and automatic retry service are not included. Manual authorised resends must avoid duplicate notices. SMTP acceptance is not proof that a recipient received or read a message.

Revalidate upload types/size checks and authenticated document retrieval. No antivirus/quarantine pipeline or independent penetration test is supplied. The operator must provide appropriate malware controls and security assurance for public uploads before launch. Restrict recovery/factory-reset controls to the owner and protect the recovery key offline. Never expose Swagger publicly in production without deliberate access restrictions.

## Production Acceptance Gates

| Gate | Responsible party | Required evidence |
| --- | --- | --- |
| Hosting and domain ownership | Client and appointed operator | Accounts, MFA, DNS, TLS and named incident contacts |
| Build and container security | Operator | Frozen install, Linux image build, scans and approved image identifiers |
| Identity and roles | Client administrator | First bootstrap disabled; successful registration/login/reset per role; forbidden-route tests |
| Residence inventory | Residence management | Signed real room register, genders, capacities and category mapping |
| Application and occupancy | Client and operator | End-to-end submit/document review/offer/accept/expire/cancel/terminate tests in staging |
| Email and templates | Client and SMTP operator | Correct residence links, sender DNS, test inbox receipt, rejection/bounce handling |
| Documents and storage | Operator and privacy lead | Private bucket, access-denial checks, upload/download tests and malware controls |
| Database recovery | Database operator | Restore evidence, agreed recovery objectives, private access and backup schedule |
| Privacy and image rights | Client legal/privacy lead | POPIA notices, operator agreements, retention policy, cross-border approval and media permission |
| Financial content | Client finance lead | Confirmed tariffs, payment wording and separately verified bank details |
| Handover and commercial | Authorised client and seller | Completed agreement, payment record, delivery manifest and acceptance record |

If a gate is unresolved, record the owner and target date and keep the service in staging. A passing local test suite is not a warranty of production readiness.

## Incident And Release Procedure

For suspected compromise, restrict access, preserve logs, revoke exposed keys/sessions and involve the client's security/privacy lead. POPIA section 22 notifications must be assessed by the responsible party. Do not erase evidence through a reset. Rotate affected DB/SMTP/storage credentials at the provider, update the secret manager, deploy and verify before revoking old access where continuity is required.

Before an update: review changes and dependency advisories, back up DB and objects, run tests in staging, confirm migration compatibility and schedule the window. Promote known image versions with a recorded approver. For failure: stop promotion, preserve logs and use the last compatible image. There is no automatic down migration; a schema rollback may require an approved restore and will affect data written after the backup. Test this plan in staging.

## Official References

- Render Blueprint configuration: https://render.com/docs/blueprint-spec
- Render environment and Docker build settings: https://render.com/docs/configure-environment-variables and https://render.com/docs/docker
- Render PostgreSQL backups: https://render.com/docs/postgresql-backups
- Render free-service limitations: https://render.com/docs/free
- AWS regional reference: https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions.html
- Nodemailer SMTP: https://nodemailer.com/smtp
- Next.js support policy: https://nextjs.org/support-policy
- POPIA Act 4 of 2013: https://www.justice.gov.za/legislation/acts/2013-004.pdf

References reviewed on 28 October 2026. Providers may change plans, regions, retention and prices; confirm them before purchase.
