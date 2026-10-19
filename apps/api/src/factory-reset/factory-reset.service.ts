import { ForbiddenException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RoleName, UserStatus } from '@prisma/client';
import { createHash, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

export const SESSION_INVALIDATED_BEFORE_KEY = 'sessionInvalidatedBefore';

const DEFAULT_ROOM_TYPES = ['Single Room'];
const RESET_STAFF_ROLES: RoleName[] = [RoleName.MANAGER, RoleName.SECURITY, RoleName.TECHNICIAN];

@Injectable()
export class FactoryResetService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async reset(actorId: string, recoveryKey: string) {
    this.assertRecoveryKey(recoveryKey);
    await this.assertAdministrator(actorId);

    const resetAt = Date.now();
    const [documents, storageRequestFiles, inspectionAttachments] = await Promise.all([
      this.prisma.document.findMany({ select: { storageKey: true } }),
      this.prisma.storageRequestFile.findMany({ select: { storageKey: true } }),
      this.prisma.inspectionAttachment.findMany({ select: { storageKey: true } }),
    ]);

    const result = await this.prisma.$transaction(async (tx) => {
      const deleted = {
        passwordResets: (await tx.passwordReset.deleteMany()).count,
        notifications: (await tx.notification.deleteMany()).count,
        communications: (await tx.communication.deleteMany()).count,
        inspectionAttachments: (await tx.inspectionAttachment.deleteMany()).count,
        inspections: (await tx.inspection.deleteMany()).count,
        inspectionPeriods: (await tx.inspectionPeriod.deleteMany()).count,
        visitorLogs: (await tx.visitorLog.deleteMany()).count,
        visitorPreRegistrations: (await tx.visitorPreRegistration.deleteMany()).count,
        incidentReports: (await tx.incidentReport.deleteMany()).count,
        maintenanceRequests: (await tx.maintenanceRequest.deleteMany()).count,
        storageStatusHistory: (await tx.storageRequestStatusHistory.deleteMany()).count,
        storageRequestFiles: (await tx.storageRequestFile.deleteMany()).count,
        storageRequests: (await tx.storageRequest.deleteMany()).count,
        paymentReminders: (await tx.paymentReminder.deleteMany()).count,
        studentRegistrationBlocks: (await tx.studentRegistrationBlock.deleteMany()).count,
        statusHistory: (await tx.applicationStatusHistory.deleteMany()).count,
        documents: (await tx.document.deleteMany()).count,
        applications: (await tx.application.deleteMany()).count,
        emailLogs: (await tx.emailLog.deleteMany()).count,
        auditLogs: (await tx.auditLog.deleteMany()).count,
        students: (
          await tx.user.deleteMany({
            where: { roles: { some: { role: { name: RoleName.STUDENT } } } },
          })
        ).count,
        staffAccounts: (
          await tx.user.deleteMany({
            where: {
              roles: {
                some: { role: { name: { in: RESET_STAFF_ROLES } } },
                none: { role: { name: RoleName.ADMINISTRATOR } },
              },
            },
          })
        ).count,
      };

      await tx.user.updateMany({ data: { refreshTokenHash: null } });
      await tx.systemSetting.upsert({
        where: { key: SESSION_INVALIDATED_BEFORE_KEY },
        create: {
          key: SESSION_INVALIDATED_BEFORE_KEY,
          value: resetAt,
          description: 'Unix timestamp in milliseconds before which sessions are invalid.',
        },
        update: {
          value: resetAt,
          description: 'Unix timestamp in milliseconds before which sessions are invalid.',
        },
      });

      await Promise.all(
        DEFAULT_ROOM_TYPES.map((roomTypeName) =>
          tx.roomType.upsert({
            where: { roomTypeName },
            create: { roomTypeName, totalRooms: 0, availableRooms: 0 },
            update: {},
          }),
        ),
      );
      await tx.roomType.deleteMany({ where: { roomTypeName: { notIn: DEFAULT_ROOM_TYPES } } });
      const roomTypes = await tx.roomType.findMany({ select: { id: true, totalRooms: true } });
      await Promise.all(
        roomTypes.map((roomType) =>
          tx.roomType.update({
            where: { id: roomType.id },
            data: { availableRooms: roomType.totalRooms },
          }),
        ),
      );
      const residences = await tx.residence.findMany({ select: { id: true, totalRooms: true } });
      await Promise.all(
        residences.map((residence) =>
          tx.residence.update({
            where: { id: residence.id },
            data: { availableRooms: residence.totalRooms },
          }),
        ),
      );
      await tx.residenceRoom.updateMany({
        data: { status: 'AVAILABLE', roomTypeName: 'Single Room', capacity: 1 },
      });
      const totalRooms = await tx.residenceRoom.count();
      await tx.roomType.update({
        where: { roomTypeName: 'Single Room' },
        data: { totalRooms, availableRooms: totalRooms },
      });

      return deleted;
    });

    const storageDeletes = await Promise.allSettled(
      [...documents, ...storageRequestFiles, ...inspectionAttachments].map((document) => this.storage.remove(document.storageKey)),
    );
    const failedStorageDeletes = storageDeletes.filter((item) => item.status === 'rejected').length;

    return {
      ok: true,
      message: 'Factory reset completed. The system has been restored to its initial state.',
      resetAt: new Date(resetAt).toISOString(),
      deleted: {
        ...result,
        uploadedFiles: storageDeletes.length - failedStorageDeletes,
        failedUploadedFiles: failedStorageDeletes,
      },
    };
  }

  private async assertAdministrator(actorId: string) {
    const administrator = await this.prisma.user.findFirst({
      where: {
        id: actorId,
        status: UserStatus.ACTIVE,
        roles: { some: { role: { name: RoleName.ADMINISTRATOR } } },
      },
      select: { id: true },
    });
    if (!administrator) {
      throw new ForbiddenException('Only active administrators can perform a factory reset');
    }
  }

  private assertRecoveryKey(recoveryKey: string) {
    const configuredKey = this.config.get<string>('FACTORY_RESET_RECOVERY_KEY');
    if (!configuredKey) {
      throw new ServiceUnavailableException('Factory reset recovery key is not configured');
    }
    if (!this.timingSafeCompare(recoveryKey.trim(), configuredKey.trim())) {
      throw new UnauthorizedException('Invalid recovery key');
    }
  }

  private timingSafeCompare(left: string, right: string) {
    const leftHash = createHash('sha256').update(left).digest();
    const rightHash = createHash('sha256').update(right).digest();
    return timingSafeEqual(leftHash, rightHash);
  }
}
