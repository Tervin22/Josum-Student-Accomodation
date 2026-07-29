# Deployment Guide

## Docker Compose

1. Provision a host with Docker and persistent storage.
2. Create `.env` from `.env.example`.
3. Set strong secrets and production values.
4. Run:

   ```bash
   docker compose up --build -d
   docker compose exec api corepack pnpm prisma:migrate:deploy
   ```

5. Put a TLS-enabled load balancer or reverse proxy in front of Nginx.

Review [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) before exposing the deployment publicly.

## AWS Cape Town

For elastic production hosting in AWS Africa (Cape Town), use the templates and checklist in [../infra/aws/README.md](../infra/aws/README.md).

The recommended production stack is ECS Fargate behind an Application Load Balancer, Aurora PostgreSQL Serverless v2 or RDS PostgreSQL Multi-AZ, private S3 document storage, Secrets Manager, and CloudWatch Logs.

## Production Storage

Set:

```env
STORAGE_DRIVER=s3
S3_BUCKET=your-bucket
S3_REGION=af-south-1
S3_USE_IAM_ROLE=true
S3_ENDPOINT=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
```

For AWS S3 on ECS, leave `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY` empty and use `S3_USE_IAM_ROLE=true`. For MinIO or another compatible provider, set access keys and `S3_FORCE_PATH_STYLE=true` when required.

Local upload storage is suitable only for a single API instance. Use private S3-compatible storage before horizontal scaling.

## Backups and Recovery

- Enable encrypted PostgreSQL backups or point-in-time recovery with off-host retention.
- Enable object versioning and replication for uploaded documents.
- Test a full database and document restore at least quarterly.
- Keep database, API, and web service ports private; expose only the TLS load balancer.

## Security Checklist

- Rotate the installation token after the first administrator is created.
- Use HTTPS only.
- Restrict `WEB_ORIGIN` to the public frontend domain.
- Use strong JWT secrets and rotate them with a planned logout window.
- Keep uploads private and serve them only through authenticated download endpoints.
- Monitor audit logs, email logs, and failed login rates.
