# Josum Student Accommodation Booking System

Full-stack student accommodation booking platform with a Next.js portal, NestJS API, PostgreSQL, Prisma, JWT authentication, RBAC, SMTP email notifications, local/S3-compatible document storage, Swagger documentation, and Docker deployment.

The original system uses Josum 1 (78 single rooms) and Josum 2 (120 single rooms). Josum 1 allocates rooms 1-50 to female students and rooms 51-78 to male students; Josum 2 is female-only. Approval requires the supporting documents and an available room with the correct gender allocation. Room moves, cancellations, approval expiry, move-out and termination update inventory through the original workflows.

A one-time guarded admin bootstrap endpoint creates the first administrator. The separate student, administrator, manager, security and technician portals provide applications, documents, room management, maintenance, storage, inspections, visitor handling, communications, reports, email templates and audit logs.

## Quick Start

1. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

2. Replace all secrets in `.env`, especially `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `POSTGRES_PASSWORD`, and `INSTALLATION_ADMIN_TOKEN`.

3. Start the stack:

   ```bash
   docker compose up --build
   ```

4. Apply database migrations:

   ```bash
   docker compose exec api corepack pnpm prisma:migrate:deploy
   ```

5. Open the web portal at [http://localhost:3000](http://localhost:3000), the reverse proxy at [http://localhost:8080](http://localhost:8080), and Swagger at [http://localhost:4000/docs](http://localhost:4000/docs).

6. Create the first administrator from the login screen's bootstrap panel or call:

   ```bash
   curl -X POST http://localhost:4000/auth/bootstrap-admin \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@example.com","password":"ChangeMe123!","firstName":"Josum","lastName":"Admin","bootstrapToken":"INSTALLATION_ADMIN_TOKEN"}'
   ```

## Development

```bash
corepack pnpm install
corepack pnpm --filter @josum/api prisma:generate
corepack pnpm --filter @josum/api prisma:migrate
corepack pnpm dev
```

The API runs on port `4000` and the Next.js app runs on port `3000`.

For an existing Windows installation with `.env.local` configured, start both servers with:

```powershell
corepack pnpm start:local
```

## Restoring An Eduloft Installation

The source has been restored to the pre-Eduloft version (`6ddbcb0`). Applied migrations remain in history; `20261019090000_restore_original_josum_system` restores the original residences, 198 single rooms, gender allocations and payment defaults. It preserves existing accounts and stops if Eduloft operational records need reconciliation.

Back up the database, then apply the migration and restart the API and web portal:

```powershell
corepack pnpm --filter @josum/api prisma:generate
corepack pnpm --filter @josum/api prisma:migrate:deploy
corepack pnpm start:local
```

Use the original database connection and SMTP settings in `.env.local`. Database migrations restore system configuration and inventory; recovering previously deleted student records requires a backup from before their deletion.

## Production Notes

- Keep the database empty on first boot unless you intentionally migrate existing real data.
- Use the admin bootstrap endpoint only once, then rotate or remove `INSTALLATION_ADMIN_TOKEN`.
- Configure `STORAGE_DRIVER=s3` with S3-compatible credentials for production document storage.
- Configure a real SMTP provider and monitor `EmailLog` records for delivery failures.
- Put Nginx or another TLS-terminating proxy in front of the app and force HTTPS.
- Run `pnpm --filter @josum/api prisma:migrate:deploy` during deployment.

More details are in [docs/INSTALLATION.md](docs/INSTALLATION.md), [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), and [docs/API.md](docs/API.md).
