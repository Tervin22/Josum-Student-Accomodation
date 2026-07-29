import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApplicationStatus,
  InspectionRating,
  InspectionSeverity,
  InspectionStatus,
  Prisma,
  UserStatus,
} from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { extname } from 'path';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateInspectionPeriodDto } from './dto/create-inspection-period.dto';
import { CreateInspectionDto } from './dto/create-inspection.dto';
import { ListInspectionsDto } from './dto/list-inspections.dto';
import { UpdateInspectionDto } from './dto/update-inspection.dto';

type UploadedInspectionFile = {
  originalName: string;
  storageKey: string;
  mimeType: string;
  size: number;
  checksum: string;
};

type InspectionResident = {
  id: string;
  name: string;
  studentNumber?: string;
  contactNumber?: string;
  email?: string;
};

const inspectionInclude = {
  period: true,
  residence: { select: { id: true, name: true, address: true } },
  room: { select: { id: true, name: true, roomNumber: true, status: true } },
  student: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      studentProfile: { select: { studentNumber: true, institution: true, profileImageUploadedAt: true } },
    },
  },
  inspector: { select: { id: true, email: true, firstName: true, lastName: true } },
  attachments: { select: { id: true, originalName: true, mimeType: true, size: true, createdAt: true } },
} as const;

const photoRules = {
  '.jpg': { mimeTypes: ['image/jpeg'], magic: [[0xff, 0xd8, 0xff]] },
  '.jpeg': { mimeTypes: ['image/jpeg'], magic: [[0xff, 0xd8, 0xff]] },
  '.png': { mimeTypes: ['image/png'], magic: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]] },
} as const;

const handoverConditionFields = [
  ['bedroom', 'Bedroom'],
  ['walls', 'Walls'],
  ['ceiling', 'Ceiling'],
  ['lights', 'Lights'],
  ['plugs', 'Plugs'],
  ['cupboards', 'Cupboards'],
  ['doorLockKey', 'Door/lock/key'],
  ['tiling', 'Tiling'],
  ['fridge', 'Fridge'],
  ['bed', 'Bed'],
  ['windowBlind', 'Window and blind'],
  ['windowFrame', 'Window frame'],
  ['other', 'Other'],
] as const;

@Injectable()
export class InspectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  async listPeriods() {
    await this.ensureDefaultPeriods();
    return this.prisma.inspectionPeriod.findMany({
      orderBy: [{ year: 'desc' }, { name: 'asc' }],
    });
  }

  async createPeriod(actorId: string, dto: CreateInspectionPeriodDto) {
    if (dto.startDate && dto.endDate && dto.endDate < dto.startDate) {
      throw new BadRequestException('Inspection period end date cannot be before the start date');
    }
    const period = await this.prisma.inspectionPeriod.create({
      data: {
        name: dto.name.trim(),
        year: dto.year,
        startDate: dto.startDate,
        endDate: dto.endDate,
        isActive: dto.isActive ?? true,
      },
    });
    await this.audit.log({
      actorId,
      action: 'CREATE_INSPECTION_PERIOD',
      entity: 'InspectionPeriod',
      entityId: period.id,
      metadata: { name: period.name, year: period.year },
    });
    return period;
  }

  async list(query: ListInspectionsDto) {
    await this.ensureDefaultPeriods();
    const skip = (query.page - 1) * query.limit;
    const where = this.inspectionWhere(query);
    const [items, total] = await Promise.all([
      this.prisma.inspection.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: [{ inspectionDate: 'desc' }, { createdAt: 'desc' }],
        include: inspectionInclude,
      }),
      this.prisma.inspection.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  async create(actorId: string, dto: CreateInspectionDto, photos: Express.Multer.File[] = []) {
    await this.assertRoomAndPeriod(dto.periodId, dto.residenceId, dto.roomId);
    await this.assertNoDuplicate(dto.periodId, dto.roomId);
    this.assertCompletionRules(dto.status ?? InspectionStatus.DRAFT, dto.inspectorConfirmed ?? false);
    photos.forEach((photo) => this.validatePhoto(photo));

    const resident = dto.studentId
      ? await this.assertStudent(dto.studentId)
      : await this.currentRoomResident(dto.residenceId, dto.roomId);
    const savedPhotos: UploadedInspectionFile[] = [];
    try {
      for (const photo of photos) {
        savedPhotos.push(await this.savePhoto(photo));
      }

      const status = this.statusFor(dto.status, dto.followUpRequired);
      const inspection = await this.prisma.inspection.create({
        data: {
          referenceCode: this.referenceCode(),
          periodId: dto.periodId,
          residenceId: dto.residenceId,
          roomId: dto.roomId,
          studentId: resident?.id,
          studentFullName: this.clean(dto.studentFullName) ?? resident?.name,
          studentNumber: this.clean(dto.studentNumber) ?? resident?.studentNumber,
          contactNumber: this.clean(dto.contactNumber) ?? resident?.contactNumber,
          emailAddress: this.clean(dto.emailAddress) ?? resident?.email,
          keyNumberIssued: this.clean(dto.keyNumberIssued),
          occupantNames: this.clean(dto.occupantNames) ?? this.clean(dto.studentFullName) ?? resident?.name,
          inspectorId: actorId,
          inspectionDate: dto.inspectionDate,
          checkInDate: dto.checkInDate,
          checkOutDate: dto.checkOutDate,
          certifiedIdCopy: dto.certifiedIdCopy ?? false,
          proofOfRegistration: dto.proofOfRegistration ?? false,
          academicRecord: dto.academicRecord ?? false,
          proofOfFunding: dto.proofOfFunding ?? false,
          signedLeaseAgreement: dto.signedLeaseAgreement ?? false,
          moveInConditions: this.conditionData(dto, 'moveIn'),
          moveOutConditions: this.conditionData(dto, 'moveOut'),
          itemsBroughtIn: this.itemsBroughtIn(dto) ?? [],
          ...this.ratingData(dto),
          damageIdentified: this.clean(dto.damageIdentified),
          maintenanceRequired: dto.maintenanceRequired ?? false,
          severity: dto.severity ?? InspectionSeverity.LOW,
          comments: this.clean(dto.comments),
          studentAcknowledgement: dto.studentAcknowledgement ?? false,
          inspectorConfirmed: dto.inspectorConfirmed ?? false,
          studentConfirmed: dto.studentConfirmed ?? false,
          followUpRequired: dto.followUpRequired ?? false,
          followUpDate: dto.followUpDate,
          followUpActions: this.clean(dto.followUpActions),
          studentDeclaration: dto.studentDeclaration ?? false,
          studentSignature: this.clean(dto.studentSignature),
          studentSignatureDate: dto.studentSignatureDate,
          managementSignatureIn: this.clean(dto.managementSignatureIn),
          managementSignatureOut: this.clean(dto.managementSignatureOut),
          tenantSignatureIn: this.clean(dto.tenantSignatureIn),
          tenantSignatureOut: this.clean(dto.tenantSignatureOut),
          status,
          completedAt: this.completedAtFor(status),
          attachments: {
            create: savedPhotos.map((photo) => ({
              uploadedById: actorId,
              originalName: photo.originalName,
              storageKey: photo.storageKey,
              mimeType: photo.mimeType,
              size: photo.size,
              checksum: photo.checksum,
            })),
          },
        },
        include: inspectionInclude,
      });
      await this.audit.log({
        actorId,
        action: 'CREATE_INSPECTION',
        entity: 'Inspection',
        entityId: inspection.id,
        metadata: {
          referenceCode: inspection.referenceCode,
          periodId: inspection.periodId,
          residenceId: inspection.residenceId,
          roomId: inspection.roomId,
          status: inspection.status,
        },
      });
      return inspection;
    } catch (error) {
      await this.cleanupSavedPhotos(savedPhotos);
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('An inspection already exists for this room and inspection period');
      }
      throw error;
    }
  }

  async update(actorId: string, id: string, dto: UpdateInspectionDto) {
    const current = await this.prisma.inspection.findUnique({ where: { id }, include: inspectionInclude });
    if (!current) {
      throw new NotFoundException('Inspection not found');
    }
    const nextStatus = this.statusFor(dto.status ?? current.status, dto.followUpRequired ?? current.followUpRequired);
    const inspectorConfirmed = dto.inspectorConfirmed ?? current.inspectorConfirmed;
    this.assertCompletionRules(nextStatus, inspectorConfirmed);
    const moveInConditions = this.conditionData(dto, 'moveIn');
    const moveOutConditions = this.conditionData(dto, 'moveOut');
    const itemsBroughtIn = this.itemsBroughtIn(dto);

    const inspection = await this.prisma.inspection.update({
      where: { id },
      data: {
        studentFullName: dto.studentFullName !== undefined ? this.clean(dto.studentFullName) : current.studentFullName,
        studentNumber: dto.studentNumber !== undefined ? this.clean(dto.studentNumber) : current.studentNumber,
        contactNumber: dto.contactNumber !== undefined ? this.clean(dto.contactNumber) : current.contactNumber,
        emailAddress: dto.emailAddress !== undefined ? this.clean(dto.emailAddress) : current.emailAddress,
        keyNumberIssued: dto.keyNumberIssued !== undefined ? this.clean(dto.keyNumberIssued) : current.keyNumberIssued,
        occupantNames: dto.occupantNames !== undefined ? this.clean(dto.occupantNames) : current.occupantNames,
        inspectionDate: dto.inspectionDate ?? current.inspectionDate,
        checkInDate: dto.checkInDate ?? current.checkInDate,
        checkOutDate: dto.checkOutDate ?? current.checkOutDate,
        certifiedIdCopy: dto.certifiedIdCopy ?? current.certifiedIdCopy,
        proofOfRegistration: dto.proofOfRegistration ?? current.proofOfRegistration,
        academicRecord: dto.academicRecord ?? current.academicRecord,
        proofOfFunding: dto.proofOfFunding ?? current.proofOfFunding,
        signedLeaseAgreement: dto.signedLeaseAgreement ?? current.signedLeaseAgreement,
        moveInConditions: moveInConditions ?? this.existingJson(current.moveInConditions),
        moveOutConditions: moveOutConditions ?? this.existingJson(current.moveOutConditions),
        itemsBroughtIn: itemsBroughtIn ?? current.itemsBroughtIn,
        ...this.ratingData(dto),
        damageIdentified: dto.damageIdentified !== undefined ? this.clean(dto.damageIdentified) : current.damageIdentified,
        maintenanceRequired: dto.maintenanceRequired ?? current.maintenanceRequired,
        severity: dto.severity ?? current.severity,
        comments: dto.comments !== undefined ? this.clean(dto.comments) : current.comments,
        studentAcknowledgement: dto.studentAcknowledgement ?? current.studentAcknowledgement,
        inspectorConfirmed,
        studentConfirmed: dto.studentConfirmed ?? current.studentConfirmed,
        followUpRequired: dto.followUpRequired ?? current.followUpRequired,
        followUpDate: dto.followUpDate ?? current.followUpDate,
        followUpActions: dto.followUpActions !== undefined ? this.clean(dto.followUpActions) : current.followUpActions,
        studentDeclaration: dto.studentDeclaration ?? current.studentDeclaration,
        studentSignature: dto.studentSignature !== undefined ? this.clean(dto.studentSignature) : current.studentSignature,
        studentSignatureDate: dto.studentSignatureDate ?? current.studentSignatureDate,
        managementSignatureIn: dto.managementSignatureIn !== undefined ? this.clean(dto.managementSignatureIn) : current.managementSignatureIn,
        managementSignatureOut: dto.managementSignatureOut !== undefined ? this.clean(dto.managementSignatureOut) : current.managementSignatureOut,
        tenantSignatureIn: dto.tenantSignatureIn !== undefined ? this.clean(dto.tenantSignatureIn) : current.tenantSignatureIn,
        tenantSignatureOut: dto.tenantSignatureOut !== undefined ? this.clean(dto.tenantSignatureOut) : current.tenantSignatureOut,
        status: nextStatus,
        completedAt: current.completedAt ?? this.completedAtFor(nextStatus),
      },
      include: inspectionInclude,
    });
    await this.audit.log({
      actorId,
      action: 'UPDATE_INSPECTION',
      entity: 'Inspection',
      entityId: id,
      metadata: { fromStatus: current.status, toStatus: inspection.status, referenceCode: inspection.referenceCode },
    });
    return inspection;
  }

  async exportCsv(actorId: string, query: ListInspectionsDto) {
    await this.ensureDefaultPeriods();
    const rows = await this.prisma.inspection.findMany({
      where: this.inspectionWhere(query),
      take: 10000,
      orderBy: [{ inspectionDate: 'desc' }, { createdAt: 'desc' }],
      include: inspectionInclude,
    });
    await this.audit.log({
      actorId,
      action: 'EXPORT_INSPECTIONS',
      entity: 'Inspection',
      metadata: {
        count: rows.length,
        periodId: query.periodId,
        residenceId: query.residenceId,
        roomId: query.roomId,
        status: query.status,
      },
    });

    const header = [
      'Reference',
      'Period',
      'Inspection date',
      'Accommodation',
      'Room',
      'Student / occupants',
      'Student number',
      'Contact number',
      'Email address',
      'Key number issued',
      'Check-in date',
      'Check-out date',
      'Certified ID copy',
      'Proof of registration',
      'Academic record',
      'Proof of funding / bursary / NSFAS',
      'Signed lease agreement',
      'Inspector',
      'Status',
      'Severity',
      'Cleanliness',
      'Walls',
      'Doors and locks',
      'Windows',
      'Flooring',
      'Ceiling',
      'Lighting',
      'Electrical sockets',
      'Plumbing',
      'Bathroom',
      'Furniture',
      'Bed',
      'Wardrobe',
      'Appliances',
      'Fire safety equipment',
      'Damage identified',
      'Maintenance required',
      'Follow-up required',
      'Follow-up date',
      'Comments',
      'Items brought in',
      'Student declaration accepted',
      'Student signature',
      'Student signature date',
      'Management signature in',
      'Management signature out',
      'Tenant signature in',
      'Tenant signature out',
      'Attachment count',
      ...handoverConditionFields.flatMap(([, label]) => [`${label} move in`, `${label} move out`]),
    ];
    const body = rows.map((inspection) => [
      inspection.referenceCode,
      `${inspection.period.name} ${inspection.period.year}`,
      this.formatDate(inspection.inspectionDate),
      inspection.residence.name,
      inspection.room.name,
      inspection.studentFullName ?? inspection.occupantNames ?? this.fullName(inspection.student),
      inspection.studentNumber ?? inspection.student?.studentProfile?.studentNumber ?? '',
      inspection.contactNumber ?? inspection.student?.phone ?? '',
      inspection.emailAddress ?? inspection.student?.email ?? '',
      inspection.keyNumberIssued ?? '',
      this.formatDate(inspection.checkInDate),
      this.formatDate(inspection.checkOutDate),
      inspection.certifiedIdCopy ? 'Yes' : 'No',
      inspection.proofOfRegistration ? 'Yes' : 'No',
      inspection.academicRecord ? 'Yes' : 'No',
      inspection.proofOfFunding ? 'Yes' : 'No',
      inspection.signedLeaseAgreement ? 'Yes' : 'No',
      this.fullName(inspection.inspector),
      this.formatEnum(inspection.status),
      this.formatEnum(inspection.severity),
      this.formatEnum(inspection.generalCleanliness),
      this.formatEnum(inspection.walls),
      this.formatEnum(inspection.doorsAndLocks),
      this.formatEnum(inspection.windows),
      this.formatEnum(inspection.flooring),
      this.formatEnum(inspection.ceiling),
      this.formatEnum(inspection.lighting),
      this.formatEnum(inspection.electricalSockets),
      this.formatEnum(inspection.plumbing),
      this.formatEnum(inspection.bathroomCondition),
      this.formatEnum(inspection.furnitureCondition),
      this.formatEnum(inspection.bedCondition),
      this.formatEnum(inspection.wardrobeCondition),
      this.formatEnum(inspection.appliances),
      this.formatEnum(inspection.fireSafetyEquipment),
      inspection.damageIdentified ?? '',
      inspection.maintenanceRequired ? 'Yes' : 'No',
      inspection.followUpRequired ? 'Yes' : 'No',
      this.formatDate(inspection.followUpDate),
      inspection.comments ?? '',
      inspection.itemsBroughtIn.join('; '),
      inspection.studentDeclaration ? 'Yes' : 'No',
      inspection.studentSignature ?? '',
      this.formatDate(inspection.studentSignatureDate),
      inspection.managementSignatureIn ?? '',
      inspection.managementSignatureOut ?? '',
      inspection.tenantSignatureIn ?? '',
      inspection.tenantSignatureOut ?? '',
      inspection.attachments.length,
      ...handoverConditionFields.flatMap(([key]) => [
        this.conditionValue(inspection.moveInConditions, key),
        this.conditionValue(inspection.moveOutConditions, key),
      ]),
    ]);

    return [header, ...body].map((row) => row.map((value) => this.csv(value)).join(',')).join('\n');
  }

  async downloadAttachment(actorId: string, attachmentId: string) {
    const attachment = await this.prisma.inspectionAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        inspection: { select: { id: true, referenceCode: true } },
      },
    });
    if (!attachment) {
      throw new NotFoundException('Inspection attachment not found');
    }
    await this.audit.log({
      actorId,
      action: 'DOWNLOAD_INSPECTION_ATTACHMENT',
      entity: 'InspectionAttachment',
      entityId: attachment.id,
      metadata: { inspectionId: attachment.inspection.id, referenceCode: attachment.inspection.referenceCode },
    });
    return { file: attachment, stream: await this.storage.read(attachment.storageKey) };
  }

  private async ensureDefaultPeriods() {
    const count = await this.prisma.inspectionPeriod.count();
    if (count) return;
    const year = new Date().getFullYear();
    await this.prisma.inspectionPeriod.createMany({
      data: ['Quarter 1', 'Quarter 2', 'Quarter 3', 'Quarter 4'].map((name) => ({ name, year })),
      skipDuplicates: true,
    });
  }

  private async assertRoomAndPeriod(periodId: string, residenceId: string, roomId: string) {
    const [period, residence, room] = await Promise.all([
      this.prisma.inspectionPeriod.findUnique({ where: { id: periodId } }),
      this.prisma.residence.findUnique({ where: { id: residenceId }, select: { id: true } }),
      this.prisma.residenceRoom.findUnique({ where: { id: roomId }, select: { id: true, residenceId: true } }),
    ]);
    if (!period) {
      throw new NotFoundException('Inspection period not found');
    }
    if (!period.isActive) {
      throw new ForbiddenException('Inspection period is inactive');
    }
    if (!residence) {
      throw new NotFoundException('Residence not found');
    }
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    if (room.residenceId !== residenceId) {
      throw new BadRequestException('Selected room does not belong to the selected residence');
    }
  }

  private async assertNoDuplicate(periodId: string, roomId: string) {
    const existing = await this.prisma.inspection.findUnique({
      where: { periodId_roomId: { periodId, roomId } },
      select: { id: true, referenceCode: true },
    });
    if (existing) {
      throw new ConflictException(`Inspection ${existing.referenceCode} already exists for this room and period`);
    }
  }

  private async assertStudent(userId: string): Promise<InspectionResident> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        status: UserStatus.ACTIVE,
        roles: { some: { role: { name: 'STUDENT' } } },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        studentProfile: { select: { studentNumber: true } },
      },
    });
    if (!user) {
      throw new NotFoundException('Student not found');
    }
    return {
      id: user.id,
      name: this.fullName(user),
      studentNumber: user.studentProfile?.studentNumber ?? undefined,
      contactNumber: user.phone ?? undefined,
      email: user.email,
    };
  }

  private async currentRoomResident(residenceId: string, roomId: string): Promise<InspectionResident | null> {
    const application = await this.prisma.application.findFirst({
      where: {
        residenceId,
        roomId,
        status: ApplicationStatus.APPROVED,
        acceptedAt: { not: null },
        cancelledAt: null,
        user: { status: UserStatus.ACTIVE },
      },
      orderBy: [{ acceptedAt: 'desc' }, { createdAt: 'desc' }],
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
    });
    return application
      ? {
          id: application.userId,
          name: this.fullName(application.user),
          studentNumber: application.studentNumber,
          contactNumber: application.studentPhone || application.user.phone || undefined,
          email: application.user.email,
        }
      : null;
  }

  private inspectionWhere(query: ListInspectionsDto): Prisma.InspectionWhereInput {
    return {
      ...(query.status ? { status: query.status } : {}),
      ...(query.periodId ? { periodId: query.periodId } : {}),
      ...(query.residenceId ? { residenceId: query.residenceId } : {}),
      ...(query.roomId ? { roomId: query.roomId } : {}),
      ...(query.search
        ? {
            OR: [
              { referenceCode: { contains: query.search, mode: 'insensitive' } },
              { occupantNames: { contains: query.search, mode: 'insensitive' } },
              { studentFullName: { contains: query.search, mode: 'insensitive' } },
              { studentNumber: { contains: query.search, mode: 'insensitive' } },
              { contactNumber: { contains: query.search, mode: 'insensitive' } },
              { emailAddress: { contains: query.search, mode: 'insensitive' } },
              { keyNumberIssued: { contains: query.search, mode: 'insensitive' } },
              { comments: { contains: query.search, mode: 'insensitive' } },
              { damageIdentified: { contains: query.search, mode: 'insensitive' } },
              { followUpActions: { contains: query.search, mode: 'insensitive' } },
              { period: { is: { name: { contains: query.search, mode: 'insensitive' } } } },
              { residence: { is: { name: { contains: query.search, mode: 'insensitive' } } } },
              { room: { is: { name: { contains: query.search, mode: 'insensitive' } } } },
              { student: { is: { firstName: { contains: query.search, mode: 'insensitive' } } } },
              { student: { is: { lastName: { contains: query.search, mode: 'insensitive' } } } },
              { student: { is: { studentProfile: { is: { studentNumber: { contains: query.search, mode: 'insensitive' } } } } } },
            ],
          }
        : {}),
    };
  }

  private ratingData(dto: Partial<Record<keyof CreateInspectionDto, unknown>>) {
    return {
      generalCleanliness: dto.generalCleanliness as InspectionRating | undefined,
      walls: dto.walls as InspectionRating | undefined,
      doorsAndLocks: dto.doorsAndLocks as InspectionRating | undefined,
      windows: dto.windows as InspectionRating | undefined,
      flooring: dto.flooring as InspectionRating | undefined,
      ceiling: dto.ceiling as InspectionRating | undefined,
      lighting: dto.lighting as InspectionRating | undefined,
      electricalSockets: dto.electricalSockets as InspectionRating | undefined,
      plumbing: dto.plumbing as InspectionRating | undefined,
      bathroomCondition: dto.bathroomCondition as InspectionRating | undefined,
      furnitureCondition: dto.furnitureCondition as InspectionRating | undefined,
      bedCondition: dto.bedCondition as InspectionRating | undefined,
      wardrobeCondition: dto.wardrobeCondition as InspectionRating | undefined,
      appliances: dto.appliances as InspectionRating | undefined,
      fireSafetyEquipment: dto.fireSafetyEquipment as InspectionRating | undefined,
    };
  }

  private conditionData(dto: CreateInspectionDto | UpdateInspectionDto, prefix: 'moveIn' | 'moveOut'): Prisma.InputJsonObject | undefined {
    const source = dto as unknown as Record<string, unknown>;
    const values: Record<string, string> = {};
    for (const [key] of handoverConditionFields) {
      const fieldName = `${prefix}${key.charAt(0).toUpperCase()}${key.slice(1)}`;
      const value = typeof source[fieldName] === 'string' ? this.clean(source[fieldName] as string) : undefined;
      if (value) {
        values[key] = value;
      }
    }
    return Object.keys(values).length ? values : undefined;
  }

  private itemsBroughtIn(dto: CreateInspectionDto | UpdateInspectionDto) {
    const source = dto as unknown as Record<string, unknown>;
    const values = [1, 2, 3, 4, 5]
      .map((index) => {
        const value = source[`itemBroughtIn${index}`];
        return typeof value === 'string' ? this.clean(value) : undefined;
      })
      .filter((value): value is string => Boolean(value));
    return values.length ? values : undefined;
  }

  private existingJson(value: unknown): Prisma.InputJsonValue | undefined {
    return value === null || value === undefined ? undefined : (value as Prisma.InputJsonValue);
  }

  private assertCompletionRules(status: InspectionStatus, inspectorConfirmed: boolean) {
    if ((status === InspectionStatus.COMPLETED || status === InspectionStatus.CLOSED) && !inspectorConfirmed) {
      throw new BadRequestException('Inspector confirmation is required before completing an inspection');
    }
  }

  private statusFor(status?: InspectionStatus, followUpRequired?: boolean) {
    if (followUpRequired && (!status || status === InspectionStatus.COMPLETED)) {
      return InspectionStatus.FOLLOW_UP_REQUIRED;
    }
    return status ?? InspectionStatus.DRAFT;
  }

  private completedAtFor(status: InspectionStatus) {
    return status === InspectionStatus.COMPLETED || status === InspectionStatus.CLOSED ? new Date() : undefined;
  }

  private validatePhoto(file: Express.Multer.File) {
    const maxBytes = this.config.get<number>('MAX_UPLOAD_BYTES') ?? 10485760;
    const extension = extname(file.originalname).toLowerCase();
    const allowed = photoRules[extension as keyof typeof photoRules];
    if (!allowed) {
      throw new BadRequestException('Inspection photos must be JPG, JPEG, or PNG files');
    }
    if (file.size > maxBytes) {
      throw new BadRequestException(`File exceeds maximum size of ${maxBytes} bytes`);
    }
    if (!(allowed.mimeTypes as readonly string[]).includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported inspection photo type: ${file.mimetype}`);
    }
    if (!this.matchesAllowedSignature(file.buffer, allowed.magic)) {
      throw new BadRequestException('Inspection photo contents do not match the declared file type');
    }
  }

  private async savePhoto(file: Express.Multer.File): Promise<UploadedInspectionFile> {
    const storageKey = await this.storage.save(file.buffer, file.originalname, file.mimetype);
    return {
      originalName: file.originalname,
      storageKey,
      mimeType: file.mimetype,
      size: file.size,
      checksum: createHash('sha256').update(file.buffer).digest('hex'),
    };
  }

  private async cleanupSavedPhotos(files: UploadedInspectionFile[]) {
    await Promise.allSettled(files.map((file) => this.storage.remove(file.storageKey)));
  }

  private matchesAllowedSignature(buffer: Buffer, signatures: readonly (readonly number[])[]) {
    return signatures.some((signature) => signature.every((byte, index) => buffer[index] === byte));
  }

  private clean(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private referenceCode() {
    return `INSP-${new Date().getFullYear()}-${randomBytes(3).toString('hex').toUpperCase()}`;
  }

  private fullName(user?: { firstName?: string | null; lastName?: string | null; email?: string | null } | null) {
    return user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email || '' : '';
  }

  private formatDate(value?: Date | null) {
    return value ? value.toISOString() : '';
  }

  private conditionValue(value: Prisma.JsonValue | null, key: string) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return '';
    }
    const candidate = (value as Record<string, unknown>)[key];
    return typeof candidate === 'string' ? candidate : '';
  }

  private formatEnum(value: string) {
    return value
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private csv(value: string | number) {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  private isUniqueViolation(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
