# Eduloft Student Accommodation System

Production-ready student accommodation application and administration platform adapted for Eduloft Centurion. The system combines a Next.js web portal, NestJS API, PostgreSQL, Prisma, JWT authentication, RBAC, document uploads, email notifications, maintenance, inspections, storage requests, reporting, and deployment templates.

## Eduloft Adaptation

The public-facing portal uses verified Eduloft source material for branding, room categories, rates, amenities, nearby places, and imagery. The seed data intentionally keeps live room inventory at zero until Eduloft administrators confirm exact room and bed counts.

Verified public room categories:

| Room category | Public layout | Public rate shown | Source status |
| --- | --- | ---: | --- |
| The Nook | 1 bed, 1 bath | R6 250 pm | Eduloft room page |
| The Studio | 2 bed, 1 bath | R5 690 pp | Eduloft homepage |
| The Quarter | 1 bed, 1 bath | R9 590 pm | Eduloft room page |
| The Loft | 1 bed, 1 bath | R9 990 pm | Eduloft room page |

Operational items that are not publicly verified, such as deposits, cancellation terms, payment banking details, live inventory, storage fees, and internal approval rules, are handled as administrator-confirmed settings or notes rather than hard-coded assumptions.

## Main Workflows

- Student account registration and secure login.
- Student profile completion with required profile photo.
- Online accommodation application with Eduloft room category preference.
- Document upload for student ID, proof of funding, guardian support, acceptance/proof of registration, and academic records.
- Staff review, status updates, notes, room assignment, and approval expiry.
- Maintenance requests, visitor/security operations, inspections, storage request workflow, and exports.
- Email templates and audit logs for operational traceability.

## Tech Stack

- Frontend: Next.js App Router, TypeScript, Tailwind CSS.
- Backend: NestJS, Prisma, PostgreSQL.
- Auth: JWT access and refresh tokens with RBAC.
- Storage: local filesystem for development, S3-compatible storage for production.
- Deployment: Docker Compose and Render blueprint.

## Quick Start

1. Copy the environment template.

   ```bash
   cp .env.example .env
   ```

2. Replace every placeholder secret in `.env`, especially `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `POSTGRES_PASSWORD`, and `INSTALLATION_ADMIN_TOKEN`.

3. Start the stack.

   ```bash
   docker compose up --build
   ```

4. Apply database migrations and seed Eduloft defaults.

   ```bash
   docker compose exec api corepack pnpm prisma:migrate:deploy
   docker compose exec api corepack pnpm prisma:seed
   ```

5. Open:

   - Web portal: [http://localhost:3000](http://localhost:3000)
   - API: [http://localhost:4000](http://localhost:4000)
   - Swagger: [http://localhost:4000/docs](http://localhost:4000/docs)
   - Mailpit: [http://localhost:8025](http://localhost:8025)

6. Create the first administrator from the login screen or call the bootstrap endpoint with the configured token.

   ```bash
   curl -X POST http://localhost:4000/auth/bootstrap-admin \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@example.com","password":"ChangeMe123!","firstName":"Eduloft","lastName":"Admin","bootstrapToken":"INSTALLATION_ADMIN_TOKEN"}'
   ```

## Local Development

```bash
corepack pnpm install
corepack pnpm --filter @josum/api prisma:generate
corepack pnpm --filter @josum/api prisma:migrate
corepack pnpm --filter @josum/api prisma:seed
corepack pnpm dev
```

The workspace package names remain `@josum/api` and `@josum/web` to avoid unnecessary package-lock churn in this inherited codebase. Product-facing names, copy, branding, seeds, and deployment examples are Eduloft-specific.

## Email Delivery

The API sends branded HTML and text emails through the SMTP settings in `.env`. Local Docker development can use Mailpit, while production must use a real provider.

Required production values:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_FROM`
- `SMTP_USER` and `SMTP_PASSWORD` when the provider requires authentication
- `PUBLIC_APP_URL` and `BRAND_LOGO_URL` so links and email logos render correctly

Default system templates are available in the Admin Dashboard under Email templates. Saving a template creates a custom override; resetting it returns that workflow to the system default template.

## Production Notes

- Configure `PUBLIC_APP_URL` and every `WEB_ORIGIN` with HTTPS URLs.
- Configure a real SMTP provider before enabling production email delivery.
- Use `STORAGE_DRIVER=s3` with S3-compatible credentials for production document storage.
- Run Prisma migrations before seeding or deploying the API.
- Seeded room categories are intake categories only; administrators must add confirmed room records before approving applications.
- Keep the admin bootstrap token private and rotate it after first setup.

## Source Records

Eduloft-specific source and asset notes are documented in:

- `docs/eduloft/source-manifest.md`
- `docs/eduloft/asset-manifest.md`
- `docs/eduloft/implementation-map.md`
