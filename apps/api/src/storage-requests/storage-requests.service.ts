import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApplicationStatus,
  Prisma,
  StorageFileType,
  StorageRequestStatus,
  UserStatus,
} from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { extname } from 'path';
import { AuditService } from '../audit/audit.service';
import { hasAnyRole, STORAGE_MANAGEMENT_ROLES } from '../common/roles/role-groups';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateStorageRequestDto } from './dto/create-storage-request.dto';
import { ListStorageRequestsDto } from './dto/list-storage-requests.dto';
import { UpdateStorageRequestDto } from './dto/update-storage-request.dto';

type AuthenticatedStorageUser = { sub: string; roles: string[] };
type UploadedStorageFile = {
  fileType: StorageFileType;
  originalName: string;
  storageKey: string;
  mimeType: string;
  size: number;
  checksum: string;
};

const storageFormFileRules = {
  '.pdf': { mimeTypes: ['application/pdf'], magic: ['%PDF'] },
  '.jpg': { mimeTypes: ['image/jpeg'], magic: [[0xff, 0xd8, 0xff]] },
  '.jpeg': { mimeTypes: ['image/jpeg'], magic: [[0xff, 0xd8, 0xff]] },
  '.png': { mimeTypes: ['image/png'], magic: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]] },
} as const;

const itemImageFileRules = {
  '.jpg': { mimeTypes: ['image/jpeg'], magic: [[0xff, 0xd8, 0xff]] },
  '.jpeg': { mimeTypes: ['image/jpeg'], magic: [[0xff, 0xd8, 0xff]] },
  '.png': { mimeTypes: ['image/png'], magic: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]] },
} as const;

const dangerousExtensions = new Set([
  '.bat',
  '.cmd',
  '.com',
  '.dll',
  '.exe',
  '.html',
  '.hta',
  '.js',
  '.jsp',
  '.msi',
  '.php',
  '.ps1',
  '.scr',
  '.sh',
  '.svg',
  '.vbs',
]);

@Injectable()
export class StorageRequestsService {
  private readonly logger = new Logger(StorageRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async create(
    userId: string,
    dto: CreateStorageRequestDto,
    storageForm?: Express.Multer.File,
    itemImages: Express.Multer.File[] = [],
  ) {
    if (!itemImages.length) {
      throw new BadRequestException('At least one clear item photograph is required');
    }
    if (!dto.storageNoticeAccepted) {
      throw new BadRequestException('Storage terms acknowledgement is required');
    }
    if (itemImages.length > this.maxItemImageCount()) {
      throw new BadRequestException(`A maximum of ${this.maxItemImageCount()} item photographs may be uploaded`);
    }

    if (storageForm) {
      this.validateFile(storageForm, StorageFileType.FORM);
    }
    itemImages.forEach((file) => this.validateFile(file, StorageFileType.ITEM_IMAGE));

    const application = await this.activeResidentApplication(userId);
    const savedFiles: UploadedStorageFile[] = [];

    try {
      if (storageForm) {
        savedFiles.push(await this.saveUpload(storageForm, StorageFileType.FORM));
      }
      for (const image of itemImages) {
        savedFiles.push(await this.saveUpload(image, StorageFileType.ITEM_IMAGE));
      }

      const request = await this.prisma.storageRequest.create({
        data: {
          referenceCode: this.referenceCode(),
          userId,
          applicationId: application.id,
          residenceId: application.residenceId,
          roomId: application.roomId,
          studentFullName:
            this.clean(dto.studentFullName) ??
            this.clean(`${application.applicantFirstName} ${application.applicantLastName}`) ??
            this.fullName(application.user),
          studentNumber: this.clean(dto.studentNumber) ?? application.studentNumber ?? application.user.studentProfile?.studentNumber,
          studentSignature: this.clean(dto.studentSignature),
          studentRoomNumber:
            this.clean(dto.studentRoomNumber) ??
            application.room?.roomNumber?.toString() ??
            application.room?.name,
          numberOfItemsStored: dto.numberOfItemsStored,
          storageSite: dto.storageSite ?? this.storageSiteFromResidence(application.residence?.name),
          storageNoticeAccepted: dto.storageNoticeAccepted,
          itemDescription: this.clean(dto.itemDescription),
          files: {
            create: savedFiles.map((file) => ({
              uploadedById: userId,
              fileType: file.fileType,
              originalName: file.originalName,
              storageKey: file.storageKey,
              mimeType: file.mimeType,
              size: file.size,
              checksum: file.checksum,
            })),
          },
          statusHistory: {
            create: {
              toStatus: StorageRequestStatus.SUBMITTED,
              changedBy: { connect: { id: userId } },
              note: 'Storage request submitted by student.',
            },
          },
        },
        include: this.storageRequestInclude,
      });

      void this.notifications.storageRequestSubmitted({
        userId,
        email: request.user.email,
        name: this.fullName(request.user),
        referenceCode: request.referenceCode,
      }).catch((error) => this.logAsyncFailure('Could not send storage submission notification', error));

      await this.audit.log({
        actorId: userId,
        action: 'CREATE_STORAGE_REQUEST',
        entity: 'StorageRequest',
        entityId: request.id,
        metadata: {
          referenceCode: request.referenceCode,
          residenceId: request.residenceId,
          roomId: request.roomId,
          fileCount: request.files.length,
        },
      });

      return request;
    } catch (error) {
      await this.cleanupSavedFiles(savedFiles);
      throw error;
    }
  }

  async listMine(userId: string) {
    return this.prisma.storageRequest.findMany({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
      include: this.storageRequestInclude,
    });
  }

  async requestRelease(userId: string, id: string) {
    const before = await this.prisma.storageRequest.findFirst({
      where: { id, userId },
      include: this.storageRequestInclude,
    });
    if (!before) {
      throw new NotFoundException('Storage request not found');
    }
    if (before.status === StorageRequestStatus.RELEASE_REQUESTED) {
      return before;
    }
    if (before.status === StorageRequestStatus.ITEMS_RELEASED) {
      throw new ConflictException('Stored items have already been released');
    }
    if (before.status !== StorageRequestStatus.ITEMS_RECEIVED) {
      throw new ConflictException('Only items that have been received into storage can be requested for checkout');
    }

    const request = await this.prisma.storageRequest.update({
      where: { id },
      data: {
        status: StorageRequestStatus.RELEASE_REQUESTED,
        statusHistory: {
          create: {
            fromStatus: before.status,
            toStatus: StorageRequestStatus.RELEASE_REQUESTED,
            note: 'Student requested stored items for checkout after recess.',
            changedBy: { connect: { id: userId } },
          },
        },
      },
      include: this.storageRequestInclude,
    });

    void this.notifications.storageRequestStatusChanged({
      userId: request.userId,
      email: request.user.email,
      name: this.fullName(request.user),
      referenceCode: request.referenceCode,
      toStatus: request.status,
      reviewNotes: request.reviewNotes,
    }).catch((error) => this.logAsyncFailure('Could not send storage release request notification', error));

    await this.audit.log({
      actorId: userId,
      action: 'REQUEST_STORAGE_RELEASE',
      entity: 'StorageRequest',
      entityId: id,
      metadata: {
        referenceCode: request.referenceCode,
        fromStatus: before.status,
        toStatus: request.status,
      },
    });

    return request;
  }

  async listAdmin(query: ListStorageRequestsDto) {
    const skip = (query.page - 1) * query.limit;
    const where = this.adminWhere(query);
    const [items, total] = await Promise.all([
      this.prisma.storageRequest.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: [{ status: 'asc' }, { submittedAt: 'desc' }],
        include: this.storageRequestInclude,
      }),
      this.prisma.storageRequest.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  async updateAdmin(actorId: string, id: string, dto: UpdateStorageRequestDto) {
    const before = await this.prisma.storageRequest.findUnique({
      where: { id },
      include: this.storageRequestInclude,
    });
    if (!before) {
      throw new NotFoundException('Storage request not found');
    }

    const nextStatus = dto.status ?? before.status;
    const reviewNotes = dto.reviewNotes !== undefined ? this.clean(dto.reviewNotes) : before.reviewNotes;
    const managementSignature =
      dto.managementSignature !== undefined ? this.clean(dto.managementSignature) : before.managementSignature;
    if (nextStatus === StorageRequestStatus.REJECTED && !reviewNotes) {
      throw new BadRequestException('Review notes are required when rejecting a storage request');
    }

    const now = new Date();
    const data: Prisma.StorageRequestUpdateInput = {
      status: nextStatus,
      reviewNotes,
      managementSignature,
    };

    if (
      nextStatus === StorageRequestStatus.UNDER_REVIEW ||
      nextStatus === StorageRequestStatus.APPROVED ||
      nextStatus === StorageRequestStatus.REJECTED
    ) {
      data.reviewedAt = before.reviewedAt ?? now;
      data.reviewedBy = { connect: { id: before.reviewedById ?? actorId } };
    }
    if (nextStatus === StorageRequestStatus.ITEMS_RECEIVED) {
      data.receivedAt = before.receivedAt ?? now;
      data.receivedBy = { connect: { id: before.receivedById ?? actorId } };
    }
    if (nextStatus === StorageRequestStatus.ITEMS_RELEASED) {
      data.releasedAt = before.releasedAt ?? now;
      data.releasedBy = { connect: { id: before.releasedById ?? actorId } };
    }
    if (before.status !== nextStatus) {
      data.statusHistory = {
        create: {
          fromStatus: before.status,
          toStatus: nextStatus,
          note: reviewNotes || undefined,
          changedBy: { connect: { id: actorId } },
        },
      };
    }

    const request = await this.prisma.storageRequest.update({
      where: { id },
      data,
      include: this.storageRequestInclude,
    });

    if (before.status !== request.status) {
      void this.notifications.storageRequestStatusChanged({
        userId: request.userId,
        email: request.user.email,
        name: this.fullName(request.user),
        referenceCode: request.referenceCode,
        toStatus: request.status,
        reviewNotes: request.reviewNotes,
      }).catch((error) => this.logAsyncFailure('Could not send storage status notification', error));
    }

    await this.audit.log({
      actorId,
      action: 'UPDATE_STORAGE_REQUEST',
      entity: 'StorageRequest',
      entityId: id,
      metadata: {
        referenceCode: request.referenceCode,
        fromStatus: before.status,
        toStatus: request.status,
      },
    });

    return request;
  }

  async downloadFile(user: AuthenticatedStorageUser, fileId: string) {
    const file = await this.prisma.storageRequestFile.findUnique({
      where: { id: fileId },
      include: {
        request: {
          select: {
            id: true,
            userId: true,
            referenceCode: true,
          },
        },
      },
    });
    if (!file) {
      throw new NotFoundException('Storage file not found');
    }
    if (file.request.userId !== user.sub && !hasAnyRole(user.roles, STORAGE_MANAGEMENT_ROLES)) {
      throw new ForbiddenException('You do not have access to this storage file');
    }

    await this.audit.log({
      actorId: user.sub,
      action: 'DOWNLOAD_STORAGE_FILE',
      entity: 'StorageRequestFile',
      entityId: file.id,
      metadata: { storageRequestId: file.request.id, referenceCode: file.request.referenceCode },
    });

    return {
      file,
      stream: await this.storage.read(file.storageKey),
    };
  }

  storageFormTemplate() {
    return [
      'JOSUM STUDENT RESIDENCE',
      '(STORAGE FORM)',
      '',
      'Student Name and Surname: ___________________________',
      'Student Number: ___________________________',
      'Student Signature: ___________________________',
      'Student Room Number: ___________________________',
      '',
      'Number of Items stored: ___________________________',
      '',
      'Item Description of items:',
      '1.',
      '2.',
      '3.',
      '4.',
      '5.',
      '',
      'Storage site: Josum One / Josum Two',
      '',
      'TAKE NOTE storage services are exclusively offered to students who will be residing at Josum for the 2025 academic year. Should you need to retrieve your belongings for reasons other than moving out, especially if the year has not lapsed, a fee of R 4 100 will be charged for every month of the duration of the storage period.',
      '',
      'Management Signature: ___________________________',
    ].join('\n');
  }

  async exportAdminCsv(actorId: string, query: ListStorageRequestsDto) {
    const rows = await this.prisma.storageRequest.findMany({
      where: this.adminWhere(query),
      take: 5000,
      orderBy: [{ status: 'asc' }, { submittedAt: 'desc' }],
      include: this.storageRequestInclude,
    });
    await this.audit.log({
      actorId,
      action: 'EXPORT_STORAGE_REQUESTS',
      entity: 'StorageRequest',
      metadata: { count: rows.length, status: query.status, residenceId: query.residenceId },
    });

    const header = [
      'Reference',
      'Status',
      'Student full name',
      'Student number',
      'Email',
      'Phone',
      'Accommodation',
      'Room',
      'Form room number',
      'Storage site',
      'Number of items stored',
      'Storage notice accepted',
      'Student signature',
      'Management signature',
      'Submitted at',
      'Reviewed at',
      'Received at',
      'Released at',
      'Description',
      'Review notes',
      'File count',
    ];
    const body = rows.map((request) => [
      request.referenceCode,
      this.formatStatus(request.status),
      request.studentFullName ?? this.fullName(request.user),
      request.studentNumber ?? request.application?.studentNumber ?? request.user.studentProfile?.studentNumber ?? '',
      request.user.email,
      request.user.phone ?? request.application?.studentPhone ?? '',
      request.residence?.name ?? '',
      request.room?.name ?? '',
      request.studentRoomNumber ?? '',
      this.formatStorageSite(request.storageSite),
      request.numberOfItemsStored ?? '',
      request.storageNoticeAccepted ? 'Yes' : 'No',
      request.studentSignature ?? '',
      request.managementSignature ?? '',
      this.formatDate(request.submittedAt),
      this.formatDate(request.reviewedAt),
      this.formatDate(request.receivedAt),
      this.formatDate(request.releasedAt),
      request.itemDescription ?? '',
      request.reviewNotes ?? '',
      request.files.length,
    ]);

    return [header, ...body].map((row) => row.map((value) => this.csv(value)).join(',')).join('\n');
  }

  private async activeResidentApplication(userId: string) {
    const application = await this.prisma.application.findFirst({
      where: {
        userId,
        status: ApplicationStatus.APPROVED,
        acceptedAt: { not: null },
        roomId: { not: null },
        cancelledAt: null,
        user: { status: UserStatus.ACTIVE },
      },
      orderBy: [{ acceptedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        user: { include: { studentProfile: true } },
        residence: true,
        room: true,
      },
    });
    if (!application) {
      throw new ForbiddenException('Storage requests are available after approval acceptance and room assignment');
    }
    return application;
  }

  private validateFile(file: Express.Multer.File, fileType: StorageFileType) {
    const maxBytes = this.config.get<number>('MAX_UPLOAD_BYTES') ?? 10485760;
    const extension = extname(file.originalname).toLowerCase();
    const allowedRules = fileType === StorageFileType.FORM ? storageFormFileRules : itemImageFileRules;
    const allowed = allowedRules[extension as keyof typeof allowedRules];

    if (!extension || dangerousExtensions.has(extension) || !allowed) {
      throw new BadRequestException(
        fileType === StorageFileType.FORM
          ? 'Storage form must be a PDF, JPG, JPEG, or PNG file'
          : 'Item photographs must be JPG, JPEG, or PNG files',
      );
    }
    if (file.size > maxBytes) {
      throw new BadRequestException(`File exceeds maximum size of ${maxBytes} bytes`);
    }
    if (!(allowed.mimeTypes as readonly string[]).includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }
    if (!this.matchesAllowedSignature(file.buffer, allowed.magic)) {
      throw new BadRequestException('File contents do not match the declared file type');
    }
  }

  private async saveUpload(file: Express.Multer.File, fileType: StorageFileType): Promise<UploadedStorageFile> {
    const storageKey = await this.storage.save(file.buffer, file.originalname, file.mimetype);
    return {
      fileType,
      originalName: file.originalname,
      storageKey,
      mimeType: file.mimetype,
      size: file.size,
      checksum: createHash('sha256').update(file.buffer).digest('hex'),
    };
  }

  private adminWhere(query: ListStorageRequestsDto): Prisma.StorageRequestWhereInput {
    return {
      ...(query.status ? { status: query.status } : {}),
      ...(query.residenceId ? { residenceId: query.residenceId } : {}),
      ...(query.search
        ? {
            OR: [
              { referenceCode: { contains: query.search, mode: 'insensitive' } },
              { studentFullName: { contains: query.search, mode: 'insensitive' } },
              { studentNumber: { contains: query.search, mode: 'insensitive' } },
              { studentRoomNumber: { contains: query.search, mode: 'insensitive' } },
              { storageSite: { contains: query.search, mode: 'insensitive' } },
              { studentSignature: { contains: query.search, mode: 'insensitive' } },
              { managementSignature: { contains: query.search, mode: 'insensitive' } },
              { itemDescription: { contains: query.search, mode: 'insensitive' } },
              { reviewNotes: { contains: query.search, mode: 'insensitive' } },
              { user: { email: { contains: query.search, mode: 'insensitive' } } },
              { user: { firstName: { contains: query.search, mode: 'insensitive' } } },
              { user: { lastName: { contains: query.search, mode: 'insensitive' } } },
              { user: { phone: { contains: query.search, mode: 'insensitive' } } },
              { user: { studentProfile: { is: { studentNumber: { contains: query.search, mode: 'insensitive' } } } } },
              { application: { is: { studentNumber: { contains: query.search, mode: 'insensitive' } } } },
              { residence: { is: { name: { contains: query.search, mode: 'insensitive' } } } },
              { room: { is: { name: { contains: query.search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };
  }

  private async cleanupSavedFiles(files: UploadedStorageFile[]) {
    const deletes = await Promise.allSettled(files.map((file) => this.storage.remove(file.storageKey)));
    deletes
      .filter((result) => result.status === 'rejected')
      .forEach((result) => {
        this.logger.error(
          'Could not clean up storage request upload',
          result.status === 'rejected' && result.reason instanceof Error ? result.reason.stack : undefined,
        );
      });
  }

  private matchesAllowedSignature(buffer: Buffer, signatures: readonly (readonly number[] | string)[]) {
    return signatures.some((signature) => {
      if (typeof signature === 'string') {
        return buffer.subarray(0, signature.length).toString('ascii') === signature;
      }
      return signature.every((byte, index) => buffer[index] === byte);
    });
  }

  private clean(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private referenceCode() {
    return `STR-${new Date().getFullYear()}-${randomBytes(3).toString('hex').toUpperCase()}`;
  }

  private fullName(user: { firstName?: string | null; lastName?: string | null; email?: string | null }) {
    return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email || 'Student';
  }

  private formatStatus(status: StorageRequestStatus) {
    return status
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private storageSiteFromResidence(name?: string | null) {
    const normalized = name?.toLowerCase() ?? '';
    if (normalized.includes('two') || normalized.includes('2')) return 'JOSUM_TWO';
    if (normalized.includes('one') || normalized.includes('1')) return 'JOSUM_ONE';
    return undefined;
  }

  private formatStorageSite(value?: string | null) {
    if (value === 'JOSUM_ONE') return 'Josum One';
    if (value === 'JOSUM_TWO') return 'Josum Two';
    return value ?? '';
  }

  private formatDate(value?: Date | null) {
    return value ? value.toISOString() : '';
  }

  private csv(value: string | number) {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  private maxItemImageCount() {
    return this.config.get<number>('STORAGE_MAX_ITEM_IMAGES') ?? 6;
  }

  private logAsyncFailure(message: string, error: unknown) {
    this.logger.error(message, error instanceof Error ? error.stack : String(error));
  }

  private readonly storageRequestInclude = {
    user: {
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        studentProfile: {
          select: {
            studentNumber: true,
            institution: true,
            course: true,
            idNumber: true,
            emergencyName: true,
            emergencyPhone: true,
          },
        },
      },
    },
    application: {
      select: {
        id: true,
        referenceCode: true,
        studentNumber: true,
        studentPhone: true,
        institutionName: true,
        studentIdNumber: true,
        fundingType: true,
        fundingReference: true,
        acceptedAt: true,
        approvedAt: true,
        status: true,
      },
    },
    residence: {
      select: {
        id: true,
        name: true,
        address: true,
      },
    },
    room: {
      select: {
        id: true,
        name: true,
        roomNumber: true,
        status: true,
      },
    },
    files: {
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        fileType: true,
        originalName: true,
        mimeType: true,
        size: true,
        createdAt: true,
      },
    },
    statusHistory: {
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fromStatus: true,
        toStatus: true,
        note: true,
        createdAt: true,
        changedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    },
    reviewedBy: {
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    },
    receivedBy: {
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    },
    releasedBy: {
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    },
  } as const;
}
