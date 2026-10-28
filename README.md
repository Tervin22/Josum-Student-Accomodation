# Student Residence Portal

Client source-code release prepared 28 October 2026.

- Frontend: apps/web
- Backend and APIs: apps/api/src
- Database: apps/api/prisma
- Deployment: render.yaml, Dockerfiles, docker-compose.prod.yml and infra
- Installation and operations: docs/handover/PRODUCTION_RUNBOOK.md

This release supports Botlogile 1, Botlogile 2, Mohunathagi Village North, Mohunathagi Village South and Res Roma. A clean installation has no accounts or numbered rooms. Read the launch gates before accepting real applications.

Use Node 22 LTS or a compatible newer supported LTS with pinned pnpm 10.14.0. Run commands here, not in System32.

```powershell
corepack enable
corepack pnpm install --frozen-lockfile
node scripts/create-environment.mjs local
# Configure the new private .env.local to use your empty PostgreSQL database.
corepack pnpm --filter @josum/api prisma:generate
corepack pnpm --filter @josum/api prisma:migrate:deploy
corepack pnpm --filter @josum/api prisma:seed
corepack pnpm dev
```

Local web: http://localhost:3000. API: http://localhost:4000. Never deploy development SMTP capture, example domains or local storage on an ephemeral host.

No secrets or historic student data are included. The current-access annex is delivered separately. Source-code copyright transfer is governed by the signed sale agreement and full payment, not merely possession of this folder. Third-party packages and media retain their own rights.
