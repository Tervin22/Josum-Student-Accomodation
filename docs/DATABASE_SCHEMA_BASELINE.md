# Database Schema Baseline

Captured before the staff-role foundation migration on 2026-07-15.

This document records the current schema shape for upgrade traceability. It intentionally documents environment variable names and data structures, not live database usernames, passwords, or secret values.

## Enums Before Upgrade

- `RoleName`: `STUDENT`, `ADMINISTRATOR`
- `UserStatus`: `ACTIVE`, `SUSPENDED`
- `ApplicationStatus`: `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `WAITLISTED`, `CANCELLED`, `MOVED_OUT`
- `DocumentType`: `ID_DOCUMENT`, `PROOF_OF_REGISTRATION`, `PROOF_OF_PAYMENT`, `OTHER`, `APPLICANT_ID_PASSPORT`, `STUDENT_COLOR_ID_PHOTOS`, `STUDENT_ACCEPTANCE_LETTER`, `GUARANTOR_SUPPORTING_DOCUMENTS`, `MEDICAL_AID_CERTIFICATE`
- `NotificationChannel`: `SYSTEM`, `EMAIL`
- `MaintenanceStatus`: `OPEN`, `ACKNOWLEDGED`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`
- `MaintenancePriority`: `LOW`, `MEDIUM`, `HIGH`, `URGENT`
- `MaintenanceCategory`: `PLUMBING`, `ELECTRICAL`, `FURNITURE`, `CLEANING`, `INTERNET`, `SECURITY`, `OTHER`
- `ResidenceRoomStatus`: `AVAILABLE`, `RESERVED`, `OCCUPIED`, `MAINTENANCE`

## Core Models Before Upgrade

- `Role`, `UserRole`, `User`: account, role, status, refresh token, profile, notification, audit, and password-reset ownership.
- `StudentProfile`: student number, institution, course, year of study, date of birth, ID number, address, and emergency fields.
- `AdministratorProfile`: administrator job title.
- `Residence`, `ResidenceRoom`, `RoomType`: residence setup, room status, room capacity, and legacy single-room type support.
- `Application`: student/residence/room selection, applicant details, guarantor/next-of-kin/medical/declaration/signature fields, status, notes, approval/cancel dates, document and history relations.
- `ApplicationStatusHistory`: application status audit trail.
- `Document`: application document metadata with storage key, checksum, uploader, mime type, and size.
- `Notification`: system/email notification records per user.
- `MaintenanceRequest`: student maintenance request details, category, priority, status, resolution note, resolver, and room type.
- `EmailLog`, `AuditLog`, `PasswordReset`, `SystemSetting`, `EmailTemplate`: operational logging, settings, templates, and password reset records.

## Required Runtime Keys Before Upgrade

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `PUBLIC_APP_URL`
- `WEB_ORIGIN`
- Production-only secret checks: `INSTALLATION_ADMIN_TOKEN`, `FACTORY_RESET_RECOVERY_KEY`

## First Upgrade Migration

- Migration: `apps/api/prisma/migrations/20260715120000_staff_roles/migration.sql`
- Adds enum values to `RoleName`: `MANAGER`, `SECURITY`, `TECHNICIAN`
