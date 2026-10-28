# Josum Client Handover

Release prepared 28 October 2026 for Josum Student Accomodation. Seller: Walter Shingube. Agreed source-code price: R8,500. Payment and signatures are not confirmed by this pack. Hosting, domain fees, support and future development are separate from the sale.

## Delivery Layout

| Folder | Purpose |
| --- | --- |
| `01_Application/apps/web` | Next.js frontend, pages, reusable components and public assets |
| `01_Application/apps/api/src` | NestJS backend, validation, access control, services and API routes |
| `01_Application/apps/api/prisma` | Authoritative PostgreSQL schema, full migration history and catalogue seed |
| `01_Application/infra` | Caddy TLS gateway and optional AWS infrastructure templates |
| `01_Application/scripts` | Environment creation, validation, safe startup and rollback-only workflow test |
| `02_Database` | Clean starter SQL, schema-only SQL and restoration instructions |
| `03_Documents` | Branded manuals, FRS, invoice, agreement and acceptance record, in PDF and editable Word formats |
| `04_Verification` | Test results, API specification, inventory, checksums and dependency information |

The separate confidential package contains current local access details and proposed new production keys. It is not part of the general ZIP. Do not put it in a public repository, website directory, Docker build context or shared staff folder.

## Release Scope

The current system supports Botlogile 1, Botlogile 2, Mohunathagi Village North, Mohunathagi Village South and Res Roma. The starter database contains residence configuration and roles, but no accounts, applications, uploaded documents or assumed numbered rooms. Every actor registers afresh. The initial administrator requires the installation token; other staff require their role-specific registration key.

Published capacity is not confirmed room inventory. A record represents one allocation slot with capacity one. Before allocations, management must approve the real room register, gender rules and any shared-room arrangements. Confirm tariffs, banking instructions, addresses, document rules and photo/logo permissions before public launch. Staff roles are system-wide, not restricted to one property.

## Read In This Order

1. Read the technical handover manual and `PRODUCTION_RUNBOOK.md`.
2. Select a hosting/support company, domain owner and named operational administrator.
3. Review the verification report and resolve every open launch gate.
4. Use either migration-based installation or the tested clean-starter SQL, never both as independent schema creation methods.
5. Configure private secrets, verified SMTP and private object storage. Enable first-admin bootstrap only for installation, then disable it again.
6. Complete staging acceptance, a real mailbox delivery test, backup restoration and the signed handover record before launch.

The legal agreement remains an unsigned draft until legal identities, authority, notice details and schedules are completed. Have a South African legal practitioner review it before execution.
