-- AlterTable
ALTER TABLE "AdministratorProfile" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Application" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ApplicationStatusHistory" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Document" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "EmailLog" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "EmailTemplate" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Notification" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PasswordReset" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Role" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Room" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RoomType" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "StudentProfile" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SystemSetting" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "id" DROP DEFAULT;
