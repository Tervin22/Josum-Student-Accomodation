import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApplicationStatus, MaintenanceStatus, Prisma, RoleName, StorageRequestStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  applicationDocumentsComplete,
  missingDocumentTypesForApplication,
  requiredDocumentTypesForApplication,
} from './application-compliance';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ListApplicationsDto } from './dto/list-applications.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';

type ApplicationNotificationSource = {
  userId: string;
  referenceCode: string;
  documents: unknown[];
  user: { email: string; firstName: string; lastName: string };
  residence: { name: string; address: string };
};

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async create(userId: string, dto: CreateApplicationDto) {
    await this.expireApprovalOffers();
    const returningStudent = dto.applicantCategory === 'RETURNING_STUDENT' || dto.returningStudent;
    const [
      roomType,
      residence,
      selectedRoom,
      studentProfile,
      duplicateApplication,
      duplicateIdentityApplication,
      storedItemsAwaitingCheckout,
    ] = await Promise.all([
      this.prisma.roomType.findUnique({ where: { id: dto.roomTypeId } }),
      this.prisma.residence.findUnique({ where: { id: dto.residenceId } }),
      dto.roomId ? this.prisma.residenceRoom.findUnique({ where: { id: dto.roomId } }) : null,
      this.prisma.studentProfile.findUnique({
        where: { userId },
        select: { profileImageUploadedAt: true },
      }),
      this.prisma.application.findFirst({
        where: {
          userId,
          status: {
            notIn: [ApplicationStatus.REJECTED, ApplicationStatus.CANCELLED, ApplicationStatus.MOVED_OUT],
          },
        },
        select: { referenceCode: true, status: true },
      }),
      this.prisma.application.findFirst({
        where: {
          userId: { not: userId },
          status: {
            notIn: [ApplicationStatus.REJECTED, ApplicationStatus.CANCELLED, ApplicationStatus.MOVED_OUT],
          },
          OR: [
            { studentNumber: this.clean(dto.studentNumber)! },
            { studentIdNumber: this.clean(dto.studentIdNumber)! },
          ],
        },
        select: { referenceCode: true, status: true },
      }),
      returningStudent
        ? this.prisma.storageRequest.findFirst({
            where: {
              userId,
              status: { in: [StorageRequestStatus.ITEMS_RECEIVED, StorageRequestStatus.RELEASE_REQUESTED] },
            },
            orderBy: [{ receivedAt: 'desc' }, { submittedAt: 'desc' }],
            select: { referenceCode: true, status: true },
          })
        : Promise.resolve(null),
    ]);
    if (!studentProfile?.profileImageUploadedAt) {
      throw new ConflictException('Upload a student profile photo before submitting an accommodation application');
    }
    if (!roomType) {
      throw new NotFoundException('Room type is not available');
    }
    if (!residence) {
      throw new NotFoundException('Selected residence is not available');
    }
    if (residence.residenceType.toLowerCase().includes('girls only') && dto.gender !== 'Female') {
      throw new ConflictException(`${residence.name} is a girls-only residence`);
    }
    if (returningStudent && storedItemsAwaitingCheckout) {
      throw new ConflictException(
        `Request checkout of stored items before submitting a returning-room application. Storage request ${storedItemsAwaitingCheckout.referenceCode} is currently ${storedItemsAwaitingCheckout.status.replaceAll('_', ' ')}.`,
      );
    }
    if (returningStudent && !selectedRoom) {
      throw new ConflictException('Returning students must choose their preferred room');
    }
    if (selectedRoom) {
      if (selectedRoom.residenceId !== residence.id) {
        throw new ConflictException('Selected room does not belong to the selected residence');
      }
      if (selectedRoom.status !== 'AVAILABLE') {
        throw new ConflictException(`${selectedRoom.name} is not currently available`);
      }
      if (selectedRoom.genderAllocation !== dto.gender) {
        throw new ConflictException(`${selectedRoom.name} is allocated to ${selectedRoom.genderAllocation.toLowerCase()} students`);
      }
    }
    if (duplicateApplication) {
      throw new ConflictException(
        `Duplicate application detected. You already have active application ${duplicateApplication.referenceCode} with status ${duplicateApplication.status.replaceAll('_', ' ')}.`,
      );
    }
    if (duplicateIdentityApplication) {
      throw new ConflictException(
        `Duplicate application detected for this student number or ID. Active application ${duplicateIdentityApplication.referenceCode} is currently ${duplicateIdentityApplication.status.replaceAll('_', ' ')}.`,
      );
    }

    const application = await this.prisma.application.create({
      data: {
        referenceCode: this.referenceCode(),
        userId,
        roomTypeId: dto.roomTypeId,
        residenceId: dto.residenceId,
        roomId: selectedRoom?.id,
        isNwuStudent: dto.isNwuStudent,
        studyYear: dto.studyYear,
        studySemester: dto.studySemester,
        returningStudent,
        applicantCategory: dto.applicantCategory,
        academicRegistrationStatus: dto.academicRegistrationStatus,
        applicantFirstName: this.clean(dto.applicantFirstName)!,
        applicantLastName: this.clean(dto.applicantLastName)!,
        studentIdNumber: this.clean(dto.studentIdNumber)!,
        studentNumber: this.clean(dto.studentNumber)!,
        studentPhone: this.clean(dto.studentPhone)!,
        institutionName: this.clean(dto.institutionName),
        courseName: this.clean(dto.courseName),
        dateOfOccupation: new Date(dto.dateOfOccupation),
        nationality: this.clean(dto.nationality),
        gender: dto.gender,
        postalCode: this.clean(dto.postalCode),
        studentAdvisorDetails: this.clean(dto.studentAdvisorDetails),
        paymentTerm: dto.paymentTerm,
        fundingType: dto.fundingType,
        fundingReference: this.clean(dto.fundingReference),
        hasMedicalConditions: dto.hasMedicalConditions,
        additionalInformation: this.clean(dto.additionalInformation),
        specialRequirements: dto.specialRequirements,
        guarantorFullName: this.clean(dto.guarantorFullName),
        guarantorIdPassport: this.clean(dto.guarantorIdPassport),
        guarantorCell: this.clean(dto.guarantorCell),
        guarantorEmail: this.clean(dto.guarantorEmail),
        guarantorAddress: this.clean(dto.guarantorAddress),
        guarantorNationality: this.clean(dto.guarantorNationality),
        guarantorEmployer: this.clean(dto.guarantorEmployer),
        nextOfKin1Name: this.clean(dto.nextOfKin1Name),
        nextOfKin1Relationship: this.clean(dto.nextOfKin1Relationship),
        nextOfKin1Cell: this.clean(dto.nextOfKin1Cell),
        nextOfKin2Name: this.clean(dto.nextOfKin2Name),
        nextOfKin2Relationship: this.clean(dto.nextOfKin2Relationship),
        nextOfKin2Cell: this.clean(dto.nextOfKin2Cell),
        nextOfKin3Name: this.clean(dto.nextOfKin3Name),
        nextOfKin3Relationship: this.clean(dto.nextOfKin3Relationship),
        nextOfKin3Cell: this.clean(dto.nextOfKin3Cell),
        medicalDetails: this.clean(dto.medicalDetails),
        termsAccepted: dto.termsAccepted,
        declarationAccepted: dto.declarationAccepted,
        electronicSignatureName: this.clean(dto.electronicSignatureName),
        electronicSignatureIdPassport: this.clean(dto.electronicSignatureIdPassport),
        signatureDataUrl: this.clean(dto.signatureDataUrl),
        signedAt: new Date(),
        statusHistory: {
          create: {
            toStatus: ApplicationStatus.SUBMITTED,
            changedById: userId,
            note: 'Application submitted by student',
          },
        },
      },
      include: this.applicationInclude,
    });

    void this.sendApplicationCreatedNotifications(application).catch((error) =>
      this.logAsyncFailure('Could not send application submission notifications', error),
    );
    return this.withCompliance(application);
  }

  async listMine(userId: string) {
    await this.expireApprovalOffers();
    const applications = await this.prisma.application.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: this.applicationInclude,
    });
    return applications.map((application) => this.withCompliance(application));
  }

  async getMine(userId: string, id: string) {
    await this.expireApprovalOffers();
    const application = await this.prisma.application.findFirst({
      where: { id, userId },
      include: this.applicationInclude,
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    return this.withCompliance(application);
  }

  async cancelMine(userId: string, id: string) {
    await this.expireApprovalOffers();
    const application = await this.prisma.application.findFirst({ where: { id, userId } });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    if (application.status === ApplicationStatus.CANCELLED || application.status === ApplicationStatus.MOVED_OUT) {
      throw new ConflictException('Application is already closed');
    }
    return this.changeStatus(userId, id, {
      status: ApplicationStatus.CANCELLED,
      note: 'Cancelled by student',
    });
  }

  async acceptMine(userId: string, id: string) {
    await this.expireApprovalOffers();
    const application = await this.prisma.application.findFirst({
      where: { id, userId },
      include: this.applicationInclude,
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    if (application.status !== ApplicationStatus.APPROVED) {
      throw new ConflictException('Only approved accommodation offers can be accepted');
    }
    if (application.acceptedAt) {
      return this.withCompliance(application);
    }
    if (application.approvalExpiresAt && application.approvalExpiresAt.getTime() <= Date.now()) {
      await this.expireApprovalOffers();
      throw new ConflictException('This accommodation offer has expired');
    }

    const accepted = await this.prisma.application.update({
      where: { id },
      data: {
        acceptedAt: new Date(),
        statusHistory: {
          create: {
            fromStatus: ApplicationStatus.APPROVED,
            toStatus: ApplicationStatus.APPROVED,
            note: 'Approved accommodation offer accepted by student',
            changedById: userId,
          },
        },
      },
      include: this.applicationInclude,
    });

    await this.audit.log({
      actorId: userId,
      action: 'ACCEPT_APPLICATION_OFFER',
      entity: 'Application',
      entityId: id,
      metadata: { referenceCode: accepted.referenceCode, acceptedAt: accepted.acceptedAt },
    });
    return this.withCompliance(accepted);
  }

  async listAdmin(query: ListApplicationsDto) {
    await this.expireApprovalOffers();
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.ApplicationWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.residenceId ? { residenceId: query.residenceId } : {}),
      ...(query.search
        ? {
            OR: [
              { referenceCode: { contains: query.search, mode: 'insensitive' } },
              { user: { email: { contains: query.search, mode: 'insensitive' } } },
              { user: { firstName: { contains: query.search, mode: 'insensitive' } } },
              { user: { lastName: { contains: query.search, mode: 'insensitive' } } },
              { roomType: { roomTypeName: { contains: query.search, mode: 'insensitive' } } },
              { residence: { name: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: this.applicationInclude,
      }),
      this.prisma.application.count({ where }),
    ]);
    return { items: items.map((application) => this.withCompliance(application)), total, page: query.page, limit: query.limit };
  }

  async getAdmin(id: string) {
    await this.expireApprovalOffers();
    const application = await this.prisma.application.findUnique({
      where: { id },
      include: this.applicationInclude,
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    return this.withCompliance(application);
  }

  async changeStatus(actorId: string, id: string, dto: UpdateApplicationStatusDto) {
    await this.expireApprovalOffers();
    const before = await this.prisma.application.findUnique({
      where: { id },
      include: { user: true, residence: true, room: true, documents: true },
    });
    if (!before) {
      throw new NotFoundException('Application not found');
    }
    if (before.status === dto.status && before.adminNotes === dto.adminNotes && (!dto.roomId || dto.roomId === before.roomId)) {
      return this.getAdmin(id);
    }
    const statusChanged = before.status !== dto.status;
    const targetRoomId = dto.roomId ?? before.roomId;
    const roomChanged = Boolean(dto.roomId && dto.roomId !== before.roomId);
    if (dto.status === ApplicationStatus.UNDER_REVIEW || dto.status === ApplicationStatus.APPROVED) {
      const missingDocuments = missingDocumentTypesForApplication(before);
      if (missingDocuments.length) {
        throw new ConflictException(`Application is missing required documents: ${missingDocuments.join(', ')}`);
      }
    }
    const documentsSatisfiedAt = applicationDocumentsComplete(before) ? before.documentsSatisfiedAt ?? new Date() : before.documentsSatisfiedAt;

    const application = await this.prisma.$transaction(async (tx) => {
      const [currentResidence, currentRoomType, targetRoom] = await Promise.all([
        tx.residence.findUnique({
          where: { id: before.residenceId },
          select: { totalRooms: true },
        }),
        tx.roomType.findUnique({
          where: { id: before.roomTypeId },
          select: { totalRooms: true },
        }),
        targetRoomId ? tx.residenceRoom.findUnique({ where: { id: targetRoomId } }) : null,
      ]);
      if (!currentResidence) {
        throw new NotFoundException('Selected residence was not found');
      }
      if (!currentRoomType) {
        throw new NotFoundException('Selected room type was not found');
      }
      if (dto.status === ApplicationStatus.APPROVED && !targetRoomId) {
        throw new ConflictException('Assign an available residence room before approving this application');
      }
      if (targetRoom) {
        if (targetRoom.residenceId !== before.residenceId) {
          throw new ConflictException('Assigned room must belong to the selected residence');
        }
        if (targetRoom.genderAllocation !== before.gender) {
          throw new ConflictException(`Assigned room is allocated to ${targetRoom.genderAllocation.toLowerCase()} students`);
        }
      }

      if (before.status === ApplicationStatus.APPROVED && before.roomId && (roomChanged || dto.status !== ApplicationStatus.APPROVED)) {
        await tx.residenceRoom.updateMany({
          where: { id: before.roomId, status: 'OCCUPIED' },
          data: { status: 'AVAILABLE' },
        });
      }

      if (dto.status === ApplicationStatus.APPROVED && targetRoomId && (before.status !== ApplicationStatus.APPROVED || roomChanged)) {
        const roomResult = await tx.residenceRoom.updateMany({
          where: { id: targetRoomId, status: 'AVAILABLE' },
          data: { status: 'OCCUPIED' },
        });
        if (!roomResult.count) {
          throw new ConflictException('The assigned room is no longer available');
        }
      }

      if (dto.status === ApplicationStatus.APPROVED && before.status !== ApplicationStatus.APPROVED) {
        const residenceResult = await tx.residence.updateMany({
          where: { id: before.residenceId, availableRooms: { gt: 0 } },
          data: { availableRooms: { decrement: 1 } },
        });
        if (residenceResult.count === 0) {
          throw new ConflictException(`No rooms are available at ${before.residence.name}`);
        }
        const roomTypeResult = await tx.roomType.updateMany({
          where: { id: before.roomTypeId, availableRooms: { gt: 0 } },
          data: { availableRooms: { decrement: 1 } },
        });
        if (roomTypeResult.count === 0) {
          throw new ConflictException('No rooms are available for the selected room type');
        }
      }

      if (before.status === ApplicationStatus.APPROVED && dto.status !== ApplicationStatus.APPROVED) {
        await tx.residence.updateMany({
          where: { id: before.residenceId, availableRooms: { lt: currentResidence.totalRooms } },
          data: { availableRooms: { increment: 1 } },
        });
        await tx.roomType.updateMany({
          where: { id: before.roomTypeId, availableRooms: { lt: currentRoomType.totalRooms } },
          data: { availableRooms: { increment: 1 } },
        });
      }

      const updated = await tx.application.update({
        where: { id },
        data: {
          status: dto.status,
          adminNotes: dto.adminNotes,
          roomId: dto.roomId,
          approvedAt: dto.status === ApplicationStatus.APPROVED ? new Date() : before.approvedAt,
          approvalExpiresAt:
            dto.status === ApplicationStatus.APPROVED && before.status !== ApplicationStatus.APPROVED
              ? this.approvalExpiryDate()
              : dto.status === ApplicationStatus.APPROVED
                ? before.approvalExpiresAt
                : null,
          acceptedAt: dto.status === ApplicationStatus.APPROVED ? before.acceptedAt : null,
          documentsSatisfiedAt,
          cancelledAt: dto.status === ApplicationStatus.CANCELLED ? new Date() : before.cancelledAt,
          statusHistory: {
            create: {
              fromStatus: before.status,
              toStatus: dto.status,
              note: dto.note,
              changedById: actorId,
            },
          },
        },
        include: this.applicationInclude,
      });
      return updated;
    });

    if (statusChanged) {
      void this.notifications.applicationStatusChanged({
        userId: application.userId,
        email: application.user.email,
        name: this.fullName(application.user),
        referenceCode: application.referenceCode,
        fromStatus: before.status,
        toStatus: dto.status,
        note: dto.note,
        residenceName: application.residence.name,
        residenceAddress: application.residence.address,
      }).catch((error) => this.logAsyncFailure('Could not send application status notification', error));
    }
    await this.audit.log({
      actorId,
      action: 'CHANGE_APPLICATION_STATUS',
      entity: 'Application',
      entityId: id,
      metadata: {
        fromStatus: before.status,
        toStatus: dto.status,
        note: dto.note,
        residenceId: before.residenceId,
        residenceName: before.residence.name,
        roomId: targetRoomId,
      },
    });

    return application;
  }

  async stats() {
    await this.expireApprovalOffers();
    const [
      students,
      applications,
      statuses,
      roomTypes,
      residences,
      documents,
      pendingApplications,
      maintenanceRequests,
      openMaintenanceRequests,
    ] = await Promise.all([
      this.prisma.userRole.count({ where: { role: { name: RoleName.STUDENT } } }),
      this.prisma.application.count(),
      this.prisma.application.groupBy({ by: ['status'], _count: { status: true } }),
      this.prisma.roomType.count(),
      this.prisma.residence.findMany({
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          address: true,
          residenceType: true,
          totalRooms: true,
          availableRooms: true,
        },
      }),
      this.prisma.document.count(),
      this.prisma.application.count({ where: { status: { in: [ApplicationStatus.SUBMITTED, ApplicationStatus.UNDER_REVIEW] } } }),
      this.prisma.maintenanceRequest.count(),
      this.prisma.maintenanceRequest.count({ where: { status: { in: [MaintenanceStatus.OPEN, MaintenanceStatus.ACKNOWLEDGED, MaintenanceStatus.IN_PROGRESS] } } }),
    ]);

    return {
      students,
      applications,
      pendingApplications,
      roomTypes,
      documents,
      maintenanceRequests,
      openMaintenanceRequests,
      totalRooms: residences.reduce((sum, residence) => sum + residence.totalRooms, 0),
      availableRooms: residences.reduce((sum, residence) => sum + residence.availableRooms, 0),
      residences: residences.map((residence) => ({
        ...residence,
        occupiedRooms: residence.totalRooms - residence.availableRooms,
      })),
      statuses: statuses.reduce<Record<string, number>>((acc, item) => {
        acc[item.status] = item._count.status;
        return acc;
      }, {}),
    };
  }

  async assertStudentOwnsApplication(userId: string, applicationId: string) {
    const application = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    if (application.userId !== userId) {
      throw new ForbiddenException('You do not have access to this application');
    }
    return application;
  }

  private referenceCode() {
    return `JSA-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`;
  }

  private async expireApprovalOffers() {
    const now = new Date();
    const expired = await this.prisma.application.findMany({
      where: {
        status: ApplicationStatus.APPROVED,
        acceptedAt: null,
        approvalExpiresAt: { lt: now },
      },
      select: {
        id: true,
        referenceCode: true,
        roomId: true,
        residenceId: true,
        roomTypeId: true,
        residence: { select: { totalRooms: true } },
        roomType: { select: { totalRooms: true } },
      },
      take: 50,
    });

    for (const application of expired) {
      await this.prisma.$transaction(async (tx) => {
        const result = await tx.application.updateMany({
          where: {
            id: application.id,
            status: ApplicationStatus.APPROVED,
            acceptedAt: null,
            approvalExpiresAt: { lt: now },
          },
          data: {
            status: ApplicationStatus.CANCELLED,
            cancelledAt: now,
            acceptedAt: null,
          },
        });
        if (!result.count) return;

        if (application.roomId) {
          await tx.residenceRoom.updateMany({
            where: { id: application.roomId, status: 'OCCUPIED' },
            data: { status: 'AVAILABLE' },
          });
        }
        await tx.residence.updateMany({
          where: { id: application.residenceId, availableRooms: { lt: application.residence.totalRooms } },
          data: { availableRooms: { increment: 1 } },
        });
        await tx.roomType.updateMany({
          where: { id: application.roomTypeId, availableRooms: { lt: application.roomType.totalRooms } },
          data: { availableRooms: { increment: 1 } },
        });
        await tx.applicationStatusHistory.create({
          data: {
            applicationId: application.id,
            fromStatus: ApplicationStatus.APPROVED,
            toStatus: ApplicationStatus.CANCELLED,
            note: `Approval offer expired before student acceptance (${application.referenceCode})`,
          },
        });
      });
    }
  }

  private approvalExpiryDate() {
    const hours = this.config.get<number>('APPLICATION_APPROVAL_EXPIRY_HOURS') ?? 72;
    return new Date(Date.now() + Math.max(hours, 1) * 60 * 60 * 1000);
  }

  private withCompliance<
    T extends {
      documents?: Array<{ type: any }> | null;
      fundingType?: string | null;
      nationality?: string | null;
      studyYear?: string | null;
      applicantCategory?: string | null;
      returningStudent?: boolean | null;
    },
  >(
    application: T,
  ) {
    const requiredDocumentTypes = requiredDocumentTypesForApplication(application);
    const missingDocumentTypes = missingDocumentTypesForApplication(application);
    return {
      ...application,
      requiredDocumentTypes,
      missingDocumentTypes,
      documentsComplete: missingDocumentTypes.length === 0,
    };
  }

  private fullName(user: { firstName: string; lastName: string }) {
    return `${user.firstName} ${user.lastName}`.trim();
  }

  private clean(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private logAsyncFailure(message: string, error: unknown) {
    this.logger.error(message, error instanceof Error ? error.stack : String(error));
  }

  private async sendApplicationCreatedNotifications(application: ApplicationNotificationSource) {
    await this.notifications.applicationSubmitted({
      userId: application.userId,
      email: application.user.email,
      name: this.fullName(application.user),
      referenceCode: application.referenceCode,
      residenceName: application.residence.name,
      residenceAddress: application.residence.address,
    });
    if (application.documents.length === 0) {
      await this.notifications.documentsRequired({
        userId: application.userId,
        email: application.user.email,
        name: this.fullName(application.user),
        referenceCode: application.referenceCode,
        residenceName: application.residence.name,
        residenceAddress: application.residence.address,
      });
    }
  }

  private readonly applicationInclude = {
    user: {
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        studentProfile: true,
      },
    },
    roomType: true,
    residence: true,
    room: true,
    documents: {
      orderBy: { createdAt: 'desc' as const },
      select: {
        id: true,
        applicationId: true,
        type: true,
        originalName: true,
        mimeType: true,
        size: true,
        createdAt: true,
      },
    },
    statusHistory: {
      orderBy: { createdAt: 'desc' as const },
      select: {
        id: true,
        fromStatus: true,
        toStatus: true,
        note: true,
        createdAt: true,
        changedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    },
  } as const;
}
