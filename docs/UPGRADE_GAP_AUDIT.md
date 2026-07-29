# Upgrade Prompt Gap Audit

Last updated: 2026-07-16

This audit maps the pasted upgrade brief to the implementation work completed so far.

## Completed or Substantially Completed

- Phase 1 assessment: project structure, schema baseline, deployment and production notes are documented.
- Phase 2 roles and staff registration: Student, Administrator, Manager, Security and Technician roles exist with backend role guards and staff registration keys read from environment variables.
- Student profile image: required for application submission, securely stored, and visible through authorised profile flows.
- Application workflow improvements: applicant category, conditional fields, supporting document checks, approval acceptance, room assignment and status history are implemented within the current status model.
- Room allocation integrity: room assignment and room availability checks are enforced server-side.
- Security role dashboard: Security users have visitor and incident workflows.
- Technician and Manager dashboards: role-specific dashboard routing is implemented.
- Maintenance SLA: acknowledgement and resolution SLA timestamps, backend sweeps, reminders, technician ownership, SLA countdown UI and status updates are implemented.
- Storage module: student storage submission, storage form download, secure form/photo uploads, admin/manager review, status history, private downloads, audit logs and CSV export are implemented.
- Maintenance communications: authorised administrators, managers and technicians can send communications to active residents, with recipient resolution, delivery counts and communication history.
- Visitor pre-registration and check-in rules: students can pre-register visitors after approval acceptance and room assignment; Security can search by student number, check visitors in/out, record checkout notes, and the backend enforces the 07:00-22:00 check-in window with Manager/Administrator override logging.
- Finance reporting: administrators and managers can view filtered active-resident finance data and export an Excel-compatible CSV without passwords, secrets or internal security fields.
- Inspections: configurable inspection periods, inspection checklist records, photo attachments, duplicate prevention per room/period, room/student history search and CSV exports are implemented.
- Manager reporting portal: managers have reporting-focused views and exports for applications, security visitors/incidents, maintenance/SLA, storage, inspections, occupancy and finance.

## Still Not Fully Completed From The Pasted Brief

- No known prompt items remain intentionally incomplete after the 2026-07-16 implementation pass.

## Notes

- Registration keys and database credentials must remain in environment files or secret storage only. They should not be printed in documentation, browser responses or source files.
- SLA hours are implemented as calendar hours unless the business later defines business-hour rules.
- Workflow notes and the verification matrix are documented in `docs/OPERATIONAL_WORKFLOWS_AND_TEST_MATRIX.md`.
