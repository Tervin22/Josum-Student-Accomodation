# Josum System Upgrade Plan

## Baseline

- Backend: NestJS API in `apps/api`, Prisma/PostgreSQL schema in `apps/api/prisma/schema.prisma`.
- Frontend: Next.js app in `apps/web`, with current student and administration dashboards.
- Existing modules: auth, applications, documents, residences, residence rooms, room types, maintenance, users, notifications, audit logs, settings, factory reset, storage, health.
- Existing production hardening: throttling, JWT auth, refresh-token revocation, password policy, audit logging, file signature validation, dashboard partial-load handling, and query indexes.

## Phase 1 - Access Control Foundation

- Add staff roles: `MANAGER`, `SECURITY`, `TECHNICIAN`.
- Add environment-key protected staff registration. Admin bootstrap remains installation-token protected and staff self-registration cannot create administrators.
- Document permission boundaries in code with shared role groups.
- Update API route guards so managers can review applications and student records, technicians can operate maintenance workflows, and admin-only settings/audit/factory reset remain restricted.
- Update web session routing and public login UI so staff can register and enter the operational dashboard without being sent to the student portal.
- Acceptance checks: Prisma generate, API lint/build/test, web build.

## Phase 2 - Student Profile and Application Compliance

- Require a student profile image before the first application can be submitted. Completed in the Phase 2 migration and `/users/me/profile-photo`.
- Expand applicant categories, registration status, funding source, document requirements, and duplicate-prevention rules. Completed for application submission and review/approval gates.
- Add acceptance expiry after approval and room release when offers expire or are cancelled. Completed with `APPLICATION_APPROVAL_EXPIRY_HOURS`, offer acceptance, and automatic expiry cleanup on application reads.
- Acceptance checks: application compliance unit tests, API lint/test/build, and web build.

## Phase 3 - Room Allocation Integrity

- Add room occupancy constraints and allocation history.
- Prevent double-allocation with transactional checks.
- Surface room availability, gender allocation, and occupancy conflicts in the admin/manager UI.

## Phase 4 - Operations Modules

- Add student storage inventory records with condition, status, linked residence/room, and audit trail.
- Extend maintenance with SLA fields, technician assignment, escalation, and overdue reporting.
- Add visitor/access logs for security.
- Add incidents, inspections, and compliance reports.

## Phase 5 - Finance and Reporting

- Add charge/payment/ledger records.
- Build finance filters and export-ready reports.
- Keep finance actions behind administrator/manager permission boundaries.

## Phase 6 - Notifications and Jobs

- Add background jobs for offer expiry, maintenance SLA escalation, inspection reminders, and visitor alerts.
- Add retry/backoff visibility for outbound email and notification jobs.

## Phase 7 - Production Readiness

- Add migration rollback notes where possible.
- Add e2e smoke coverage for login, dashboards, application creation, document uploads, room allocation, maintenance, and staff role boundaries.
- Produce deployment checklist with required environment variables, backup procedure, migration command, and post-deploy smoke checks.
