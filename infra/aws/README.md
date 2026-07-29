# AWS Cape Town Production Runbook

This folder contains production templates for deploying the Josum Student Accommodation system to AWS Africa (Cape Town), `af-south-1`.

## Target Architecture

```text
Route 53
  -> CloudFront + AWS WAF
  -> Application Load Balancer
  -> ECS Fargate services
       - josum-web, port 3000
       - josum-api, port 4000
  -> Aurora PostgreSQL Serverless v2 or RDS PostgreSQL Multi-AZ
  -> S3 private document bucket
  -> Secrets Manager
  -> CloudWatch Logs
```

## Files Added

- `.env.production.example` - production environment reference.
- `docker-compose.prod.yml` - production-like compose reference for a single host or smoke testing.
- `.github/workflows/deploy-aws.yml` - builds images, pushes to ECR, runs Prisma migrations, and deploys ECS services.
- `infra/aws/ecs/*.template.json` - ECS Fargate task definition templates.
- `infra/aws/iam/*.json` - starter IAM policies for S3 and Secrets Manager access.

## 1. Create AWS Infrastructure

Use region `af-south-1`.

Create:

- VPC across at least 2 Availability Zones.
- Public subnets for the Application Load Balancer.
- Private subnets for ECS tasks and database.
- NAT Gateway or VPC endpoints so private ECS tasks can reach ECR, CloudWatch Logs, Secrets Manager, and S3.
- Aurora PostgreSQL Serverless v2 or RDS PostgreSQL Multi-AZ.
- Private S3 bucket for document uploads.
- ECS cluster named `josum-production`.
- ECR repositories named `josum-api` and `josum-web`.
- Application Load Balancer with HTTPS listener and ACM certificate.
- Target group for API port `4000`, health check path `/health/ready`.
- Target group for web port `3000`, health check path `/login`.

Suggested domains:

```text
portal.yourdomain.co.za -> web service
api.yourdomain.co.za    -> API service
```

## 2. Create Secrets Manager Secret

Create one JSON secret named `josum/production` with these keys:

```json
{
  "DATABASE_URL": "postgresql://USER:PASSWORD@RDS-ENDPOINT:5432/josum_accommodation?schema=public",
  "JWT_ACCESS_SECRET": "replace-with-strong-secret-at-least-32-chars",
  "JWT_REFRESH_SECRET": "replace-with-different-strong-secret-at-least-32-chars",
  "INSTALLATION_ADMIN_TOKEN": "replace-with-strong-bootstrap-token",
  "FACTORY_RESET_RECOVERY_KEY": "replace-with-strong-reset-key",
  "STAFF_MANAGER_REGISTRATION_KEY": "replace-with-strong-manager-key",
  "STAFF_SECURITY_REGISTRATION_KEY": "replace-with-strong-security-key",
  "STAFF_TECHNICIAN_REGISTRATION_KEY": "replace-with-strong-technician-key",
  "SMTP_USER": "smtp-user-or-empty-string",
  "SMTP_PASSWORD": "smtp-password-or-empty-string"
}
```

Production refuses placeholder secrets, HTTP public URLs, and incomplete S3 settings.

## 3. Configure IAM

Create an ECS task execution role and attach:

- AWS managed policy `AmazonECSTaskExecutionRolePolicy`.
- A policy based on `infra/aws/iam/execution-role-secrets-policy.json`, updated with your AWS account ID and secret ARN.

Create an ECS task role and attach:

- A policy based on `infra/aws/iam/task-role-s3-policy.json`, updated with your real S3 bucket name.

The app now supports `S3_USE_IAM_ROLE=true`, so ECS can access S3 through the task role instead of storing long-lived S3 access keys.

Create a GitHub Actions deployment role trusted by GitHub OIDC. It needs permission to:

- Push images to ECR.
- Register ECS task definitions.
- Update the `josum-api` and `josum-web` ECS services.
- Run and describe the migration ECS task.
- Create/update CloudWatch log groups.
- Pass the ECS execution role and task role to ECS.

## 4. Configure GitHub

In the GitHub repository, add these **Actions secrets**:

```text
AWS_GITHUB_ACTIONS_ROLE_ARN
APP_SECRET_ARN
ECS_TASK_EXECUTION_ROLE_ARN
ECS_TASK_ROLE_ARN
```

Add these **Actions variables**:

```text
ECS_CLUSTER=josum-production
API_ECS_SERVICE=josum-api
WEB_ECS_SERVICE=josum-web
PUBLIC_APP_URL=https://portal.yourdomain.co.za
API_BASE_URL=https://api.yourdomain.co.za
WEB_ORIGIN=https://portal.yourdomain.co.za
NEXT_PUBLIC_API_URL=https://api.yourdomain.co.za
S3_BUCKET=josum-production-documents
SMTP_HOST=smtp.your-provider.example
SMTP_PORT=587
SMTP_SECURE=false
SMTP_FROM=Josum Student Accommodation <no-reply@yourdomain.co.za>
ECS_PRIVATE_SUBNETS=subnet-11111111111111111,subnet-22222222222222222
ECS_TASK_SECURITY_GROUPS=sg-11111111111111111
```

Optional variables:

```text
NEXT_PUBLIC_BRAND_LOGO_URL=https://...
NEXT_PUBLIC_AUTH_HERO_IMAGE_URL=https://...
```

## 5. First Deployment

1. Create the ECS services once with placeholder task definitions, desired count `2`, and private subnet networking.
2. Connect the services to the ALB target groups.
3. Push to `main` or run the `Deploy to AWS Cape Town` workflow manually.
4. The workflow will:
   - Build API and web Docker images.
   - Push both images to ECR.
   - Render ECS task definitions from the templates.
   - Run `pnpm prisma:migrate:deploy` as a one-off Fargate task.
   - Deploy API and web services.

## 6. After First Login

1. Open `https://portal.yourdomain.co.za`.
2. Create the first administrator with the bootstrap panel.
3. Rotate or remove `INSTALLATION_ADMIN_TOKEN`.
4. Configure rooms, phases, staff registration keys, email templates, and SLA settings.
5. Test student registration, document uploads, application submission, visitor pre-registration, visitor checkout escalation, maintenance SLA escalation, and factory reset.

## 7. Production Checks

Before opening the system to students:

- Database backups enabled.
- S3 versioning enabled.
- ALB only exposes HTTPS.
- API and database are not publicly reachable.
- WAF enabled on CloudFront or ALB.
- CloudWatch alarms exist for ECS task failures, ALB 5xx errors, and database storage/CPU.
- A restore test has been completed for database and S3 documents.
