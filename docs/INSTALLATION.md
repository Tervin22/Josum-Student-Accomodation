# Installation Guide

## Requirements

- Node.js 22+
- pnpm 10+
- Docker and Docker Compose
- PostgreSQL 16 for non-Docker deployments
- SMTP credentials for production email
- S3-compatible object storage for production file storage

## Local Development

1. Install dependencies with `corepack pnpm install`.
2. Copy `.env.example` to `.env` and replace secrets.
3. Start PostgreSQL and Mailpit with `docker compose up postgres mailpit`.
4. Generate Prisma Client with `corepack pnpm --filter @josum/api prisma:generate`.
5. Run migrations with `corepack pnpm --filter @josum/api prisma:migrate`.
6. Start both apps with `corepack pnpm dev`.

## First Administrator

This application intentionally does not seed users or settings. It creates the standard three accommodation phases with zero available rooms. Create the first administrator through `POST /auth/bootstrap-admin` using `INSTALLATION_ADMIN_TOKEN`. After a first administrator exists, the endpoint is disabled.

## Empty Inventory

The database starts with Phase 1, Phase 2, and Phase 3 set to zero rooms. Administrators must set each phase's total and available room counts in the admin portal before students can apply.
