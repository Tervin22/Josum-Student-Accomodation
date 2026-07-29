# Run Without Docker

This app can run directly on Windows with Node.js and Corepack. PostgreSQL is still required because the API is built for a real PostgreSQL database.

## 1. Prepare Environment

Copy the local template:

```powershell
Copy-Item .env.local.example .env.local
Copy-Item .env.local apps/api/.env
Copy-Item apps/web/.env.local.example apps/web/.env.local
```

Update `.env.local` with a real PostgreSQL URL. For local PostgreSQL, create a database named `louiseville_accommodation` and use:

```env
DATABASE_URL=postgresql://louiseville:change-me@localhost:5432/louiseville_accommodation?schema=public
```

For hosted PostgreSQL, paste the provider's pooled or direct connection string.

After changing `.env.local`, run `Copy-Item .env.local apps/api/.env -Force` so Prisma CLI sees the same database URL.

## 2. Install And Generate

```powershell
corepack pnpm install
corepack pnpm --filter @josum/api prisma:generate
```

## 3. Migrate Database

```powershell
corepack pnpm --filter @josum/api prisma:migrate
```

For an existing production database, use:

```powershell
corepack pnpm --filter @josum/api prisma:migrate:deploy
```

## 4. Start App

```powershell
corepack pnpm start:local
```

Open:

- Web: http://localhost:3000
- API health: http://localhost:4000/health
- Swagger: http://localhost:4000/docs

## Notes

- If SMTP is not running locally, email actions still create `EmailLog` rows with `FAILED` status.
- File uploads are stored in `uploads/` when `STORAGE_DRIVER=local`.
- The first administrator is created through `/auth/bootstrap-admin` using `INSTALLATION_ADMIN_TOKEN`.
