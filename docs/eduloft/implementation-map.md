# Eduloft Implementation Map

## Branding

- `apps/web/lib/brand.ts` defaults the product name to Eduloft and uses local Eduloft assets.
- `apps/web/tailwind.config.ts` updates the palette to Eduloft-inspired black, amber, paper, and neutral line colors.
- `apps/web/app/layout.tsx` updates metadata for Eduloft.
- `apps/web/app/(auth)/login/page.tsx` updates the hero, portal copy, and login entry points.

## Public Content

- `apps/web/app/residences/page.tsx` presents verified public room categories, amenities, nearby places, and source-safe intake notes.
- `apps/web/lib/eduloft.ts` centralizes Eduloft room, amenities, nearby place, contact, and storage-site constants.

## Data And Workflows

- `apps/api/prisma/seed.ts` seeds Eduloft Centurion and the four public room categories with zero inventory.
- `apps/api/src/room-types/room-types.service.ts` exposes Eduloft room categories and syncs their counts from confirmed numbered-room inventory.
- Application approval still requires an assigned available room, which prevents staff from approving applications before confirmed inventory exists.
- Student applications are no longer blocked by zero seeded inventory; they can be submitted for staff review.

## Safety Changes

- Hard-coded Josum storage fees, payment amounts, banking details, and gender-specific room rules were removed from user-facing Eduloft flows.
- Payment reminder templates now direct students to the latest Eduloft-approved invoice or payment instruction.
- Storage workflow copy now requires Eduloft management confirmation before use.
- Legacy browser session keys are still cleared so older local sessions do not leak across the rebrand.

## Deployment

- `render.yaml` has been restored as an Eduloft Render blueprint.
- `.env.example`, `.env.local.example`, `docker-compose.yml`, and `apps/web/Dockerfile` default to Eduloft names and local Eduloft assets.
