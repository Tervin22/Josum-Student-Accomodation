# Operational Workflows And Test Matrix

Last updated: 2026-07-16

This document summarizes the production workflows added from the upgrade prompt and the verification checks run after implementation.

## Staff Registration And Login

- Manager, Security and Technician accounts register through the staff registration flow.
- Staff registration keys are read from environment variables and are not exposed in source, API responses or UI documentation.
- Login routes staff users to the correct dashboard: Manager, Security or Technician.

## Maintenance And SLA

- New maintenance tickets receive an acknowledgement deadline using calendar hours.
- Acknowledgement SLA default is 24 hours.
- Resolution SLA defaults are 48 hours for low/medium priority and 12 hours for high/urgent priority.
- Backend sweep jobs mark breached tickets and send reminders.
- Acknowledgement reminders go to active technicians.
- Resolution reminders go to the assigned technician, or active technicians if no owner exists.
- Resolution notes are required before resolving or closing a ticket.

## Maintenance Communications

- Administrators, Managers and Technicians can send resident communications.
- Recipients are resolved from approved, accepted, room-assigned active residents with valid email addresses.
- The system records sender, scope, recipient count, successful deliveries and failed deliveries.
- Communication history is visible to authorised maintenance oversight users.

## Storage

- Students can submit storage requests only after approval acceptance and room assignment.
- The student does not manually type profile/residence fields; the backend links the request to their active application.
- A completed form and at least one item photo are required.
- Administrators and Managers can review, approve, reject, receive, release, filter and export storage records.
- Storage files are private downloads protected by role and ownership checks.

## Visitor And Security

- Students can pre-register expected visitors after approval acceptance and active room assignment.
- Security can search by student number and view active resident details plus pending pre-registrations.
- Visitor check-in requires terms acceptance and a linked student/pre-registration.
- Check-in is enforced on the backend between 07:00 and 22:00 Africa/Johannesburg time.
- Manager or Administrator override requires a reason and is audit logged.
- Security can check visitors out once and record checkout notes.
- Incident capture and review remain available from the Security and Manager workflows.

## Finance Reporting

- Finance reporting includes approved, accepted, actively room-assigned residents.
- Filters include search, accommodation and funding type.
- CSV export is Excel-compatible and excludes passwords, secrets and internal security fields.
- Export actions are audit logged.

## Inspections

- Inspection periods are configurable; default Quarter 1 to Quarter 4 periods are created when none exist.
- Room inspections capture the full checklist, status, severity, comments, acknowledgements, follow-up fields and supporting photos.
- Duplicate inspections are prevented for the same room and period.
- Administrators and Managers can search, filter, update and export inspection records.

## Manager Reporting

- The Manager dashboard provides reporting-focused views for applications, students, rooms, maintenance/SLA, visitors, incidents, storage, finance, inspections and communications.
- Finance, storage and inspections include export actions.

## Verification Matrix

| Check | Result |
| --- | --- |
| Prisma schema format | Passed |
| Prisma Client generation | Passed |
| Database migrations deploy | Passed |
| API build | Passed |
| API lint | Passed |
| API tests | Passed, 21 tests |
| Web build | Passed |
| API health route | HTTP 200 |
| Admin inspections dashboard route | HTTP 200 |
| Manager dashboard route | HTTP 200 |
| Security dashboard route | HTTP 200 |

Note: Jest still reports an existing open-handle warning after all suites pass. No failing test remains from this implementation.
