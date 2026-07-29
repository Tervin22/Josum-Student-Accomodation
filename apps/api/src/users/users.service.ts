import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApplicationStatus, Prisma, RegistrationBlockIdentifierType, RoleName, StayStatus, UserStatus } from '@prisma/client';
import { createHash } from 'crypto';
import { extname } from 'path';
import { AuditService } from '../audit/audit.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { TerminateStudentDto } from './dto/terminate-student.dto';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

type StudentSerializeOptions = {
  includeRestrictedStudentAdminData?: boolean;
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  async listStudents(query: PaginationDto, viewerRoles: readonly string[] = []) {
    const skip = (query.page - 1) * query.limit;
    const includeRestrictedStudentAdminData = this.canViewRestrictedStudentAdminData(viewerRoles);
    const where = {
      roles: { some: { role: { name: RoleName.STUDENT } } },
      ...(includeRestrictedStudentAdminData ? {} : { sourceRegistrationBlocks: { none: { active: true } } }),
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' as const } },
              { firstName: { contains: query.search, mode: 'insensitive' as const } },
              { lastName: { contains: query.search, mode: 'insensitive' as const } },
              { studentProfile: { is: { studentNumber: { contains: query.search, mode: 'insensitive' as const } } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: this.userInclude,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((user) => this.serialize(user, { includeRestrictedStudentAdminData })),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async getStudent(id: string, viewerRoles: readonly string[] = []) {
    const includeRestrictedStudentAdminData = this.canViewRestrictedStudentAdminData(viewerRoles);
    const user = await this.prisma.user.findFirst({
      where: { id, roles: { some: { role: { name: RoleName.STUDENT } } } },
      include: {
        ...this.userInclude,
        applications: {
          orderBy: { createdAt: 'desc' },
          include: { roomType: true, residence: true, room: true, statusHistory: { orderBy: { createdAt: 'desc' } } },
        },
      },
    });
    if (!user) {
      throw new NotFoundException('Student not found');
    }
    if (!includeRestrictedStudentAdminData && this.hasRestrictedStudentAdminData(user)) {
      throw new NotFoundException('Student not found');
    }
    return this.serialize(user, { includeRestrictedStudentAdminData });
  }

  async updateMyProfile(userId: string, dto: UpdateStudentProfileDto) {
    const studentNumber = this.cleanOptionalString(dto.studentNumber);
    if (studentNumber) {
      const existingStudentNumber = await this.prisma.studentProfile.findFirst({
        where: { studentNumber, userId: { not: userId } },
      });
      if (existingStudentNumber) {
        throw new ConflictException('Student number is already registered');
      }
    }

    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          firstName: this.cleanOptionalString(dto.firstName),
          lastName: this.cleanOptionalString(dto.lastName),
          phone: this.cleanOptionalString(dto.phone),
          studentProfile: {
            upsert: {
              create: {
                studentNumber,
                institution: this.cleanOptionalString(dto.institution),
                course: this.cleanOptionalString(dto.course),
                yearOfStudy: dto.yearOfStudy,
                dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
                idNumber: this.cleanOptionalString(dto.idNumber),
                address: this.cleanOptionalString(dto.address),
                emergencyName: this.cleanOptionalString(dto.emergencyName),
                emergencyPhone: this.cleanOptionalString(dto.emergencyPhone),
              },
              update: {
                studentNumber,
                institution: this.cleanOptionalString(dto.institution),
                course: this.cleanOptionalString(dto.course),
                yearOfStudy: dto.yearOfStudy,
                dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
                idNumber: this.cleanOptionalString(dto.idNumber),
                address: this.cleanOptionalString(dto.address),
                emergencyName: this.cleanOptionalString(dto.emergencyName),
                emergencyPhone: this.cleanOptionalString(dto.emergencyPhone),
              },
            },
          },
        },
        include: this.userInclude,
      });
      return this.serialize(user);
    } catch (error) {
      if (this.isUniqueConstraint(error, 'studentNumber')) {
        throw new ConflictException('Student number is already registered');
      }
      throw error;
    }
  }

  async uploadMyProfilePhoto(userId: string, file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Profile photo is required');
    }
    this.validateProfilePhoto(file);

    const previousProfile = await this.prisma.studentProfile.findUnique({ where: { userId } });
    const storageKey = await this.storage.save(file.buffer, file.originalname, file.mimetype);
    const checksum = createHash('sha256').update(file.buffer).digest('hex');

    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          studentProfile: {
            upsert: {
              create: {
                profileImageStorageKey: storageKey,
                profileImageOriginalName: file.originalname,
                profileImageMimeType: file.mimetype,
                profileImageSize: file.size,
                profileImageChecksum: checksum,
                profileImageUploadedAt: new Date(),
              },
              update: {
                profileImageStorageKey: storageKey,
                profileImageOriginalName: file.originalname,
                profileImageMimeType: file.mimetype,
                profileImageSize: file.size,
                profileImageChecksum: checksum,
                profileImageUploadedAt: new Date(),
              },
            },
          },
        },
        include: this.userInclude,
      });

      if (previousProfile?.profileImageStorageKey && previousProfile.profileImageStorageKey !== storageKey) {
        await this.storage.remove(previousProfile.profileImageStorageKey).catch((error) => {
          this.logger.error(
            `Could not remove previous profile image ${previousProfile.profileImageStorageKey}`,
            error instanceof Error ? error.stack : String(error),
          );
        });
      }

      await this.audit.log({
        actorId: userId,
        action: 'UPLOAD_PROFILE_PHOTO',
        entity: 'StudentProfile',
        entityId: user.studentProfile?.id,
        metadata: { mimeType: file.mimetype, size: file.size },
      });
      return this.serialize(user);
    } catch (error) {
      await this.storage.remove(storageKey).catch((cleanupError) => {
        this.logger.error(
          `Could not remove orphaned profile image ${storageKey}`,
          cleanupError instanceof Error ? cleanupError.stack : String(cleanupError),
        );
      });
      throw error;
    }
  }

  async updateStudentStatus(actorId: string, studentId: string, dto: UpdateUserStatusDto) {
    if (dto.status === UserStatus.ACTIVE) {
      const activeBlocks = await this.prisma.studentRegistrationBlock.count({
        where: { sourceUserId: studentId, active: true },
      });
      if (activeBlocks > 0) {
        throw new ConflictException('Whitelist this student before reactivating the account');
      }
    }

    const user = await this.prisma.user.update({
      where: { id: studentId },
      data: { status: dto.status },
      include: this.userInclude,
    });
    await this.audit.log({
      actorId,
      action: 'UPDATE_STUDENT_STATUS',
      entity: 'User',
      entityId: studentId,
      metadata: { status: dto.status },
    });
    return this.serialize(user, { includeRestrictedStudentAdminData: true });
  }

  async terminateStudent(actorId: string, studentId: string, dto: TerminateStudentDto) {
    const reason = this.cleanOptionalString(dto.reason);
    if (!reason) {
      throw new BadRequestException('Termination reason is required');
    }

    const student = await this.prisma.user.findFirst({
      where: { id: studentId, roles: { some: { role: { name: RoleName.STUDENT } } } },
      include: {
        roles: { include: { role: true } },
        studentProfile: true,
        administratorProfile: true,
        applications: {
          where: {
            status: ApplicationStatus.APPROVED,
            acceptedAt: { not: null },
            roomId: { not: null },
            stayStatus: StayStatus.ACTIVE,
            terminatedAt: null,
          },
          orderBy: [{ acceptedAt: 'desc' }, { createdAt: 'desc' }],
          take: 1,
          include: {
            residence: { select: { id: true, name: true, address: true, totalRooms: true } },
            roomType: { select: { id: true, roomTypeName: true, totalRooms: true } },
            room: { select: { id: true, name: true, status: true } },
          },
        },
      },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    const application = student.applications[0];
    if (!application) {
      throw new ConflictException('Student does not have an active accepted stay to terminate');
    }

    const now = new Date();
    const identifiers = this.registrationBlockIdentifiers(student, application);
    await this.prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { id: application.id },
        data: {
          status: ApplicationStatus.MOVED_OUT,
          stayStatus: StayStatus.TERMINATED,
          terminatedAt: now,
          terminatedById: actorId,
          terminationReason: reason,
          statusHistory: {
            create: {
              fromStatus: application.status,
              toStatus: ApplicationStatus.MOVED_OUT,
              note: `Stay terminated: ${reason}`,
              changedById: actorId,
            },
          },
        },
      });

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
      await tx.user.update({
        where: { id: studentId },
        data: {
          status: UserStatus.SUSPENDED,
          refreshTokenHash: null,
        },
      });
      for (const identifier of identifiers) {
        await tx.studentRegistrationBlock.upsert({
          where: {
            identifierType_identifierNormalized: {
              identifierType: identifier.type,
              identifierNormalized: identifier.value,
            },
          },
          create: {
            identifierType: identifier.type,
            identifierNormalized: identifier.value,
            active: true,
            reason,
            sourceUserId: studentId,
            applicationId: application.id,
            blockedAt: now,
            blockedById: actorId,
          },
          update: {
            active: true,
            reason,
            sourceUserId: studentId,
            applicationId: application.id,
            blockedAt: now,
            blockedById: actorId,
            whitelistedAt: null,
            whitelistedById: null,
          },
        });
      }
      await tx.notification.create({
        data: {
          userId: studentId,
          title: 'Accommodation stay terminated',
          body: `Your accommodation stay at ${application.residence.name} has been terminated.`,
        },
      });
    });

    await this.mail.sendTemplate(student.email, 'student-stay-terminated', {
      name: this.fullName(student) || student.email,
      residenceName: application.residence.name,
      roomName: application.room?.name ?? 'Assigned room',
      studentNumber: student.studentProfile?.studentNumber ?? application.studentNumber,
      terminatedAt: now.toISOString(),
      terminationReason: reason,
    });
    await this.audit.log({
      actorId,
      action: 'TERMINATE_STUDENT_STAY',
      entity: 'Application',
      entityId: application.id,
      metadata: {
        studentId,
        referenceCode: application.referenceCode,
        residenceId: application.residenceId,
        roomId: application.roomId,
        identifiersBlocked: identifiers.map((identifier) => identifier.type),
      },
    });

    return this.getStudent(studentId, [RoleName.ADMINISTRATOR]);
  }

  async whitelistStudent(actorId: string, studentId: string) {
    const student = await this.prisma.user.findFirst({
      where: { id: studentId, roles: { some: { role: { name: RoleName.STUDENT } } } },
      include: {
        sourceRegistrationBlocks: {
          where: { active: true },
          select: { id: true, identifierType: true, identifierNormalized: true },
        },
      },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    if (!student.sourceRegistrationBlocks.length) {
      throw new ConflictException('Student is not currently blocked from registration');
    }

    const now = new Date();
    await this.prisma.studentRegistrationBlock.updateMany({
      where: { sourceUserId: studentId, active: true },
      data: {
        active: false,
        whitelistedAt: now,
        whitelistedById: actorId,
      },
    });
    await this.audit.log({
      actorId,
      action: 'WHITELIST_STUDENT_REGISTRATION',
      entity: 'User',
      entityId: studentId,
      metadata: {
        identifiersWhitelisted: student.sourceRegistrationBlocks.map((block) => block.identifierType),
      },
    });

    return this.getStudent(studentId, [RoleName.ADMINISTRATOR]);
  }

  private serialize(user: any, options: StudentSerializeOptions = {}) {
    const { roles, ...safe } = user;
    const includeRestrictedStudentAdminData = Boolean(options.includeRestrictedStudentAdminData);
    delete safe.passwordHash;
    delete safe.refreshTokenHash;
    if (safe.studentProfile) {
      const { profileImageStorageKey, ...studentProfile } = safe.studentProfile;
      safe.studentProfile = {
        ...studentProfile,
        hasProfileImage: Boolean(studentProfile.profileImageUploadedAt),
      };
      void profileImageStorageKey;
    }
    const latestStay = safe.applications?.[0]
      ? {
          id: safe.applications[0].id,
          referenceCode: safe.applications[0].referenceCode,
          status: safe.applications[0].status,
          stayStatus: safe.applications[0].stayStatus,
          residenceName: safe.applications[0].residence?.name,
          roomName: safe.applications[0].room?.name,
          fundingType: safe.applications[0].fundingType,
          acceptedAt: safe.applications[0].acceptedAt,
          terminatedAt: safe.applications[0].terminatedAt,
          terminationReason: safe.applications[0].terminationReason,
        }
      : null;
    const registrationBlocks = includeRestrictedStudentAdminData ? safe.sourceRegistrationBlocks ?? [] : [];
    delete safe.applications;
    delete safe.sourceRegistrationBlocks;
    return {
      ...safe,
      roles: roles?.map((item) => item.role.name) ?? [],
      latestStay,
      registrationBlocks,
      isRegistrationBlocked: includeRestrictedStudentAdminData
        ? registrationBlocks.some((block: { active?: boolean }) => block.active)
        : false,
    };
  }

  private canViewRestrictedStudentAdminData(roles: readonly string[] | undefined) {
    return roles?.includes(RoleName.ADMINISTRATOR) ?? false;
  }

  private hasRestrictedStudentAdminData(user: any) {
    return (
      user.sourceRegistrationBlocks?.some((block: { active?: boolean }) => block.active) ||
      user.applications?.some(
        (application: { stayStatus?: StayStatus; terminatedAt?: Date | null }) =>
          application.stayStatus === StayStatus.TERMINATED || Boolean(application.terminatedAt),
      )
    );
  }

  private registrationBlockIdentifiers(
    user: {
      email: string;
      studentProfile?: { idNumber?: string | null; studentNumber?: string | null } | null;
    },
    application?: { studentIdNumber?: string | null; studentNumber?: string | null } | null,
  ) {
    return [
      { type: RegistrationBlockIdentifierType.EMAIL, value: this.normalizeIdentifier(RegistrationBlockIdentifierType.EMAIL, user.email) },
      {
        type: RegistrationBlockIdentifierType.ID_NUMBER,
        value: this.normalizeIdentifier(RegistrationBlockIdentifierType.ID_NUMBER, user.studentProfile?.idNumber ?? application?.studentIdNumber),
      },
      {
        type: RegistrationBlockIdentifierType.STUDENT_NUMBER,
        value: this.normalizeIdentifier(
          RegistrationBlockIdentifierType.STUDENT_NUMBER,
          user.studentProfile?.studentNumber ?? application?.studentNumber,
        ),
      },
    ].filter((identifier): identifier is { type: RegistrationBlockIdentifierType; value: string } => Boolean(identifier.value));
  }

  private normalizeIdentifier(type: RegistrationBlockIdentifierType, value?: string | null) {
    const trimmed = value?.trim();
    if (!trimmed) return '';
    if (type === RegistrationBlockIdentifierType.EMAIL) return trimmed.toLowerCase();
    if (type === RegistrationBlockIdentifierType.ID_NUMBER) return trimmed.replace(/\D/g, '');
    return trimmed.toUpperCase();
  }

  private fullName(user: { firstName: string; lastName: string }) {
    return `${user.firstName} ${user.lastName}`.trim();
  }

  private cleanOptionalString(value?: string) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private isUniqueConstraint(error: unknown, field: string) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
    const target = (error.meta as { target?: unknown } | undefined)?.target;
    return Array.isArray(target) && target.includes(field);
  }

  private validateProfilePhoto(file: Express.Multer.File) {
    const maxBytes = Math.min(this.config.get<number>('MAX_UPLOAD_BYTES') ?? 10 * 1024 * 1024, 5 * 1024 * 1024);
    const extension = extname(file.originalname).toLowerCase();
    const allowed = profilePhotoTypes[extension];

    if (!allowed) {
      throw new BadRequestException('Profile photo must be a JPEG or PNG image');
    }
    if (file.size > maxBytes) {
      throw new BadRequestException(`Profile photo exceeds maximum size of ${maxBytes} bytes`);
    }
    if (!allowed.mimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported profile photo type: ${file.mimetype}`);
    }
    if (!allowed.magic.every((byte, index) => file.buffer[index] === byte)) {
      throw new BadRequestException('Profile photo contents do not match the declared image type');
    }
  }

  private readonly userInclude = Prisma.validator<Prisma.UserInclude>()({
    roles: { include: { role: true } },
    studentProfile: true,
    administratorProfile: true,
    applications: {
      where: { acceptedAt: { not: null } },
      orderBy: [{ acceptedAt: 'desc' }, { createdAt: 'desc' }],
      take: 1,
      select: {
        id: true,
        referenceCode: true,
        status: true,
        stayStatus: true,
        fundingType: true,
        acceptedAt: true,
        terminatedAt: true,
        terminationReason: true,
        residence: { select: { name: true } },
        room: { select: { name: true } },
      },
    },
    sourceRegistrationBlocks: {
      orderBy: [{ active: 'desc' }, { blockedAt: 'desc' }],
      take: 10,
      select: {
        id: true,
        identifierType: true,
        identifierNormalized: true,
        active: true,
        reason: true,
        blockedAt: true,
        whitelistedAt: true,
      },
    },
  });
}

const profilePhotoTypes: Record<string, { mimeTypes: string[]; magic: number[] }> = {
  '.jpg': { mimeTypes: ['image/jpeg'], magic: [0xff, 0xd8, 0xff] },
  '.jpeg': { mimeTypes: ['image/jpeg'], magic: [0xff, 0xd8, 0xff] },
  '.png': { mimeTypes: ['image/png'], magic: [0x89, 0x50, 0x4e, 0x47] },
};
