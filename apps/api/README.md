# Backend And Database

NestJS modules under src own their controllers, DTO validation, services and tests. prisma/schema.prisma and prisma/migrations are the authoritative database source; prisma/seed.ts creates only missing roles and residence configuration. Use prisma:migrate:deploy in production, never migrate dev or reset. The exported OpenAPI reference documents routes and DTOs. See the production runbook.
