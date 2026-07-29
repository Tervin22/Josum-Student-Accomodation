import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ApplicationStatus, RoleName, UserStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CheckoutVisitorDto } from './dto/checkout-visitor.dto';
import { CreateIncidentReportDto } from './dto/create-incident-report.dto';
import { CreateVisitorPreRegistrationDto } from './dto/create-visitor-pre-registration.dto';
import { CreateVisitorLogDto } from './dto/create-visitor-log.dto';
import { ListVisitorPreRegistrationsDto } from './dto/list-visitor-pre-registrations.dto';
import { ListSecurityRecordsDto } from './dto/list-security-records.dto';
import { UpdateIncidentReportDto } from './dto/update-incident-report.dto';
import { UpdateVisitorPreRegistrationStatusDto } from './dto/update-visitor-pre-registration-status.dto';

type VisitorReminderRecipient = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

@Injectable()
export class SecurityService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SecurityService.name);
  private visitorCheckoutSweep?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
      return;
    }
    this.visitorCheckoutSweep = setInterval(() => {
      void this.syncVisitorCheckoutReminders().catch((error) =>
        this.logAsyncFailure('Could not send visitor checkout reminders', error),
      );
    }, this.visitorCheckoutSweepIntervalMs());
    this.visitorCheckoutSweep.unref?.();
  }

  onModuleDestroy() {
    if (this.visitorCheckoutSweep) {
      clearInterval(this.visitorCheckoutSweep);
    }
  }

  async listVisitors(query: ListSecurityRecordsDto) {
    await this.syncVisitorCheckoutReminders();
    const skip = (query.page - 1) * query.limit;
    const where = {
      ...(query.residenceId ? { residenceId: query.residenceId } : {}),
      ...(query.search
        ? {
            OR: [
              { visitorName: { contains: query.search, mode: 'insensitive' as const } },
              { residentName: { contains: query.search, mode: 'insensitive' as const } },
              { visitorPhone: { contains: query.search, mode: 'insensitive' as const } },
              { vehicleRegistration: { contains: query.search, mode: 'insensitive' as const } },
              { user: { studentProfile: { is: { studentNumber: { contains: query.search, mode: 'insensitive' as const } } } } },
              { residence: { is: { name: { contains: query.search, mode: 'insensitive' as const } } } },
              { room: { is: { name: { contains: query.search, mode: 'insensitive' as const } } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.visitorLog.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { checkedInAt: 'desc' },
        include: this.visitorInclude,
      }),
      this.prisma.visitorLog.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  async listVisitorPreRegistrations(query: ListVisitorPreRegistrationsDto) {
    const skip = (query.page - 1) * query.limit;
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.residenceId ? { residenceId: query.residenceId } : {}),
      ...(query.search
        ? {
            OR: [
              { visitorName: { contains: query.search, mode: 'insensitive' as const } },
              { visitorPhone: { contains: query.search, mode: 'insensitive' as const } },
              { visitorIdNumber: { contains: query.search, mode: 'insensitive' as const } },
              { relationship: { contains: query.search, mode: 'insensitive' as const } },
              { vehicleRegistration: { contains: query.search, mode: 'insensitive' as const } },
              { notes: { contains: query.search, mode: 'insensitive' as const } },
              { user: { email: { contains: query.search, mode: 'insensitive' as const } } },
              { user: { firstName: { contains: query.search, mode: 'insensitive' as const } } },
              { user: { lastName: { contains: query.search, mode: 'insensitive' as const } } },
              { user: { studentProfile: { is: { studentNumber: { contains: query.search, mode: 'insensitive' as const } } } } },
              { residence: { is: { name: { contains: query.search, mode: 'insensitive' as const } } } },
              { room: { is: { name: { contains: query.search, mode: 'insensitive' as const } } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.visitorPreRegistration.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: [{ status: 'asc' }, { expectedVisitDate: 'asc' }, { expectedArrivalTime: 'asc' }],
        include: this.preRegistrationInclude,
      }),
      this.prisma.visitorPreRegistration.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  async listMyVisitorPreRegistrations(userId: string) {
    return this.prisma.visitorPreRegistration.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        residence: { select: { id: true, name: true, address: true } },
        room: { select: { id: true, name: true, roomNumber: true } },
        visitorLog: { select: { id: true, checkedInAt: true, checkedOutAt: true } },
      },
    });
  }

  async createVisitorPreRegistration(userId: string, dto: CreateVisitorPreRegistrationDto) {
    if (!dto.termsAccepted) {
      throw new BadRequestException('Visitor terms and conditions must be accepted');
    }
    const application = await this.activeResidentApplication(userId);
    const preRegistration = await this.prisma.visitorPreRegistration.create({
      data: {
        userId,
        residenceId: application.residenceId,
        roomId: application.roomId,
        visitorName: dto.visitorName.trim(),
        visitorPhone: this.clean(dto.visitorPhone),
        visitorIdNumber: this.clean(dto.visitorIdNumber),
        relationship: dto.relationship.trim(),
        expectedVisitDate: dto.expectedVisitDate,
        expectedArrivalTime: dto.expectedArrivalTime.trim(),
        vehicleRegistration: this.clean(dto.vehicleRegistration),
        notes: this.clean(dto.notes),
        termsAccepted: dto.termsAccepted,
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, studentProfile: { select: { studentNumber: true } } } },
        residence: { select: { id: true, name: true, address: true } },
        room: { select: { id: true, name: true, roomNumber: true } },
      },
    });
    void this.notifySecurityVisitorPreRegistrationSubmitted(preRegistration).catch((error) =>
      this.logAsyncFailure('Could not send visitor pre-registration notification', error),
    );
    await this.audit.log({
      actorId: userId,
      action: 'CREATE_VISITOR_PRE_REGISTRATION',
      entity: 'VisitorPreRegistration',
      entityId: preRegistration.id,
      metadata: { residenceId: preRegistration.residenceId, roomId: preRegistration.roomId },
    });
    return preRegistration;
  }

  async lookupStudent(studentNumber: string) {
    const application = await this.activeResidentApplicationByStudentNumber(studentNumber);
    const preRegistrations = await this.prisma.visitorPreRegistration.findMany({
      where: {
        userId: application.userId,
        status: 'APPROVED',
      },
      orderBy: [{ expectedVisitDate: 'asc' }, { expectedArrivalTime: 'asc' }],
      select: {
        id: true,
        visitorName: true,
        visitorPhone: true,
        visitorIdNumber: true,
        relationship: true,
        expectedVisitDate: true,
        expectedArrivalTime: true,
        vehicleRegistration: true,
        notes: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return { ...this.studentLookupPayload(application), preRegistrations };
  }

  async createVisitor(actor: { sub: string; roles: string[] }, dto: CreateVisitorLogDto) {
    if (!dto.termsAccepted) {
      throw new BadRequestException('Visitor terms and conditions must be accepted');
    }
    const now = new Date();
    const override = this.checkCheckInWindow(actor, dto, now);
    let residentContext: Awaited<ReturnType<typeof this.activeResidentApplicationByStudentNumber>> | null = null;
    let preRegistration:
      | Awaited<ReturnType<typeof this.prisma.visitorPreRegistration.findUnique>>
      | null = null;

    if (dto.preRegistrationId) {
      preRegistration = await this.prisma.visitorPreRegistration.findUnique({
        where: { id: dto.preRegistrationId },
        include: {
          user: { include: { studentProfile: true } },
          residence: true,
          room: true,
        },
      });
      if (!preRegistration) {
        throw new NotFoundException('Visitor pre-registration not found');
      }
      if (preRegistration.status !== 'APPROVED') {
        throw new ConflictException('Visitor pre-registration must be approved by security before check-in');
      }
      residentContext = await this.activeResidentApplication(preRegistration.userId);
    } else if (dto.studentNumber) {
      residentContext = await this.activeResidentApplicationByStudentNumber(dto.studentNumber);
    } else if (dto.residenceId) {
      await this.assertResidenceExists(dto.residenceId);
    } else {
      throw new BadRequestException('Student number or pre-registration is required for visitor check-in');
    }

    const visitor = await this.prisma.visitorLog.create({
      data: {
        visitorName: (preRegistration?.visitorName ?? dto.visitorName).trim(),
        visitorPhone: this.clean(preRegistration?.visitorPhone ?? dto.visitorPhone),
        visitorIdNumber: this.clean(preRegistration?.visitorIdNumber ?? dto.visitorIdNumber),
        userId: residentContext?.userId,
        roomId: residentContext?.roomId,
        preRegistrationId: preRegistration?.id,
        residentName: residentContext ? this.fullName(residentContext.user) : this.clean(dto.residentName),
        residenceId: residentContext?.residenceId ?? dto.residenceId,
        relationship: this.clean(preRegistration?.relationship ?? dto.relationship),
        purpose: this.clean(dto.purpose),
        vehicleRegistration: this.clean(preRegistration?.vehicleRegistration ?? dto.vehicleRegistration),
        notes: this.clean(dto.notes),
        termsAccepted: dto.termsAccepted,
        recordedById: actor.sub,
        overrideReason: override ? this.clean(dto.overrideReason) : undefined,
        overrideById: override ? actor.sub : undefined,
        overrideAt: override ? now : undefined,
      },
      include: this.visitorInclude,
    });
    if (preRegistration) {
      await this.prisma.visitorPreRegistration.update({
        where: { id: preRegistration.id },
        data: { status: 'CHECKED_IN' },
      });
    }
    await this.audit.log({
      actorId: actor.sub,
      action: 'CREATE_VISITOR_LOG',
      entity: 'VisitorLog',
      entityId: visitor.id,
      metadata: {
        residenceId: visitor.residenceId,
        visitorName: visitor.visitorName,
        studentNumber: residentContext?.studentNumber,
        override,
      },
    });
    if (override) {
      await this.audit.log({
        actorId: actor.sub,
        action: 'OVERRIDE_VISITOR_CHECK_IN_HOURS',
        entity: 'VisitorLog',
        entityId: visitor.id,
        metadata: { reason: dto.overrideReason, checkedInAt: visitor.checkedInAt },
      });
    }
    return visitor;
  }

  async updateVisitorPreRegistrationStatus(
    actorId: string,
    id: string,
    dto: UpdateVisitorPreRegistrationStatusDto,
  ) {
    const current = await this.prisma.visitorPreRegistration.findUnique({
      where: { id },
      include: this.preRegistrationInclude,
    });
    if (!current) {
      throw new NotFoundException('Visitor pre-registration not found');
    }
    if (current.status === 'CHECKED_IN') {
      throw new ConflictException('Visitor pre-registration has already been used for check-in');
    }
    if (current.status === dto.status) {
      return current;
    }

    const preRegistration = await this.prisma.visitorPreRegistration.update({
      where: { id },
      data: { status: dto.status },
      include: this.preRegistrationInclude,
    });

    void this.notifications.visitorPreRegistrationStatusChanged({
      userId: preRegistration.userId,
      email: preRegistration.user.email,
      name: this.fullName(preRegistration.user),
      visitorName: preRegistration.visitorName,
      status: preRegistration.status,
      expectedVisitDate: this.formatJohannesburgDate(preRegistration.expectedVisitDate),
      expectedArrivalTime: preRegistration.expectedArrivalTime,
      residenceName: preRegistration.residence?.name,
      roomName: this.roomName(preRegistration.room),
      note: this.clean(dto.note),
    }).catch((error) => this.logAsyncFailure('Could not send visitor pre-registration status notification', error));

    await this.audit.log({
      actorId,
      action: 'UPDATE_VISITOR_PRE_REGISTRATION_STATUS',
      entity: 'VisitorPreRegistration',
      entityId: id,
      metadata: {
        fromStatus: current.status,
        toStatus: preRegistration.status,
        visitorName: preRegistration.visitorName,
        note: this.clean(dto.note),
      },
    });
    return preRegistration;
  }

  async checkoutVisitor(actorId: string, id: string, dto: CheckoutVisitorDto) {
    const current = await this.prisma.visitorLog.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException('Visitor log not found');
    }
    if (current.checkedOutAt) {
      throw new ConflictException('Visitor is already checked out');
    }
    const visitor = await this.prisma.visitorLog.update({
      where: { id },
      data: { checkedOutAt: new Date(), checkedOutById: actorId, checkoutNotes: this.clean(dto.checkoutNotes) },
      include: this.visitorInclude,
    });
    await this.audit.log({
      actorId,
      action: 'CHECKOUT_VISITOR',
      entity: 'VisitorLog',
      entityId: id,
      metadata: {
        visitorName: visitor.visitorName,
        checkoutReminderSentAt: visitor.checkoutReminderSentAt,
      },
    });
    return visitor;
  }

  async listIncidents(query: ListSecurityRecordsDto) {
    const skip = (query.page - 1) * query.limit;
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.residenceId ? { residenceId: query.residenceId } : {}),
      ...(query.search
        ? {
            OR: [
              { referenceCode: { contains: query.search, mode: 'insensitive' as const } },
              { title: { contains: query.search, mode: 'insensitive' as const } },
              { description: { contains: query.search, mode: 'insensitive' as const } },
              { category: { contains: query.search, mode: 'insensitive' as const } },
              { location: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.incidentReport.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.incidentReport.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  async createIncident(actorId: string, dto: CreateIncidentReportDto) {
    if (dto.residenceId) {
      await this.assertResidenceExists(dto.residenceId);
    }
    const incident = await this.prisma.incidentReport.create({
      data: {
        referenceCode: this.referenceCode(),
        title: dto.title.trim(),
        description: dto.description.trim(),
        category: dto.category.trim(),
        severity: dto.severity,
        residenceId: dto.residenceId,
        location: this.clean(dto.location),
        reportedById: actorId,
      },
    });
    await this.audit.log({
      actorId,
      action: 'CREATE_INCIDENT_REPORT',
      entity: 'IncidentReport',
      entityId: incident.id,
      metadata: { referenceCode: incident.referenceCode, severity: incident.severity },
    });
    return incident;
  }

  async updateIncident(actorId: string, id: string, dto: UpdateIncidentReportDto) {
    const current = await this.prisma.incidentReport.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException('Incident report not found');
    }
    const status = dto.status ?? current.status;
    if ((status === 'RESOLVED' || status === 'CLOSED') && !this.clean(dto.resolutionNote) && !current.resolutionNote) {
      throw new ConflictException('A resolution note is required before resolving or closing an incident');
    }
    const incident = await this.prisma.incidentReport.update({
      where: { id },
      data: {
        status,
        resolutionNote: dto.resolutionNote !== undefined ? this.clean(dto.resolutionNote) : current.resolutionNote,
        resolvedAt: status === 'RESOLVED' || status === 'CLOSED' ? current.resolvedAt ?? new Date() : null,
      },
    });
    await this.audit.log({
      actorId,
      action: 'UPDATE_INCIDENT_REPORT',
      entity: 'IncidentReport',
      entityId: id,
      metadata: { fromStatus: current.status, toStatus: incident.status },
    });
    return incident;
  }

  private async assertResidenceExists(residenceId: string) {
    const residence = await this.prisma.residence.findUnique({ where: { id: residenceId }, select: { id: true } });
    if (!residence) {
      throw new NotFoundException('Residence not found');
    }
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
      throw new ForbiddenException('Visitor registration is available only to active residents with an assigned room');
    }
    return application;
  }

  private async activeResidentApplicationByStudentNumber(studentNumber?: string) {
    const cleanStudentNumber = this.clean(studentNumber);
    if (!cleanStudentNumber) {
      throw new BadRequestException('Student number is required');
    }
    const application = await this.prisma.application.findFirst({
      where: {
        studentNumber: cleanStudentNumber,
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
      throw new NotFoundException('Active resident was not found for this student number');
    }
    return application;
  }

  private checkCheckInWindow(actor: { roles: string[] }, dto: CreateVisitorLogDto, now: Date) {
    const hour = Number(
      new Intl.DateTimeFormat('en-ZA', {
        timeZone: 'Africa/Johannesburg',
        hour: '2-digit',
        hour12: false,
      }).format(now),
    );
    const inWindow = hour >= 7 && hour < 22;
    if (inWindow) return false;
    const mayOverride = actor.roles.includes(RoleName.ADMINISTRATOR) || actor.roles.includes(RoleName.MANAGER);
    if (!mayOverride) {
      throw new ForbiddenException('Visitor check-in is allowed only between 07:00 and 22:00');
    }
    if (!this.clean(dto.overrideReason)) {
      throw new BadRequestException('Override reason is required for visitor check-in outside 07:00 to 22:00');
    }
    return true;
  }

  private studentLookupPayload(application: Awaited<ReturnType<typeof this.activeResidentApplication>>) {
    return {
      userId: application.userId,
      studentName: this.fullName(application.user),
      studentNumber: application.studentNumber,
      profileImageUploadedAt: application.user.studentProfile?.profileImageUploadedAt ?? null,
      hasProfileImage: Boolean(application.user.studentProfile?.profileImageUploadedAt),
      residence: { id: application.residence.id, name: application.residence.name, address: application.residence.address },
      room: application.room ? { id: application.room.id, name: application.room.name, roomNumber: application.room.roomNumber } : null,
      residencyStatus: 'Active resident',
    };
  }

  private fullName(user: { firstName?: string | null; lastName?: string | null; email?: string | null }) {
    return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email || 'Student';
  }

  private referenceCode() {
    return `SEC-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`;
  }

  private async syncVisitorCheckoutReminders() {
    const now = new Date();
    const visitors = await this.prisma.visitorLog.findMany({
      where: {
        checkedOutAt: null,
        checkoutReminderSentAt: null,
        checkedInAt: { lte: now },
      },
      orderBy: { checkedInAt: 'asc' },
      take: 100,
      select: {
        id: true,
        visitorName: true,
        visitorPhone: true,
        visitorIdNumber: true,
        residentName: true,
        relationship: true,
        purpose: true,
        vehicleRegistration: true,
        notes: true,
        checkedInAt: true,
        residence: { select: { name: true } },
        room: { select: { name: true, roomNumber: true } },
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            studentProfile: { select: { studentNumber: true } },
          },
        },
        recordedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true,
            roles: { select: { role: { select: { name: true } } } },
          },
        },
      },
    });

    for (const visitor of visitors) {
      const checkoutDueAt = this.visitorCheckoutDueAt(visitor.checkedInAt);
      if (checkoutDueAt > now) continue;

      const claimed = await this.prisma.visitorLog.updateMany({
        where: {
          id: visitor.id,
          checkedOutAt: null,
          checkoutReminderSentAt: null,
        },
        data: { checkoutReminderSentAt: now },
      });
      if (!claimed.count) continue;

      const recipients = await this.visitorCheckoutReminderRecipients(visitor.recordedBy);
      await this.sendVisitorCheckoutReminders({
        visitor,
        checkoutDueAt,
        recipients,
      });
    }
  }

  private async visitorCheckoutReminderRecipients(recordedBy?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: UserStatus;
    roles: Array<{ role: { name: RoleName } }>;
  } | null) {
    const recipients = new Map<string, VisitorReminderRecipient>();
    const [securityUsers, managers] = await Promise.all([
      this.activeSecurityNotificationRecipients(),
      this.activeManagerNotificationRecipients(),
    ]);
    securityUsers.forEach((security) => recipients.set(security.id, security));
    if (
      recordedBy?.status === UserStatus.ACTIVE &&
      recordedBy.roles.some((item) => item.role.name === RoleName.SECURITY)
    ) {
      recipients.set(recordedBy.id, {
        id: recordedBy.id,
        email: recordedBy.email,
        firstName: recordedBy.firstName,
        lastName: recordedBy.lastName,
      });
    }

    managers.forEach((manager) => recipients.set(manager.id, manager));
    return Array.from(recipients.values());
  }

  private async activeManagerNotificationRecipients() {
    const where = {
      status: UserStatus.ACTIVE,
      roles: { some: { role: { name: RoleName.MANAGER } } },
    };
    const select = {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    };
    const loggedIn = await this.prisma.user.findMany({
      where: { ...where, refreshTokenHash: { not: null } },
      select,
    });
    if (loggedIn.length) return loggedIn;
    return this.prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        roles: { some: { role: { name: RoleName.MANAGER } } },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });
  }

  private async sendVisitorCheckoutReminders(input: {
    recipients: VisitorReminderRecipient[];
    checkoutDueAt: Date;
    visitor: {
      id: string;
      visitorName: string;
      visitorPhone?: string | null;
      visitorIdNumber?: string | null;
      residentName?: string | null;
      relationship?: string | null;
      purpose?: string | null;
      vehicleRegistration?: string | null;
      notes?: string | null;
      checkedInAt: Date;
      residence?: { name: string } | null;
      room?: { name: string; roomNumber: number } | null;
      user?: {
        firstName?: string | null;
        lastName?: string | null;
        email?: string | null;
        studentProfile?: { studentNumber?: string | null } | null;
      } | null;
      recordedBy?: { firstName: string; lastName: string; email: string } | null;
    };
  }) {
    const visitor = input.visitor;
    const residentName = visitor.residentName ?? (visitor.user ? this.fullName(visitor.user) : undefined);
    const recordedByName = visitor.recordedBy ? this.fullName(visitor.recordedBy) : undefined;
    const roomName = visitor.room?.name ?? (visitor.room?.roomNumber ? `Room ${visitor.room.roomNumber}` : undefined);

    for (const recipient of input.recipients) {
      await this.notifications.visitorCheckoutOverdueReminder({
        userId: recipient.id,
        email: recipient.email,
        name: this.fullName(recipient),
        visitorName: visitor.visitorName,
        visitorPhone: visitor.visitorPhone,
        visitorIdNumber: visitor.visitorIdNumber,
        residentName,
        studentNumber: visitor.user?.studentProfile?.studentNumber,
        residenceName: visitor.residence?.name,
        roomName,
        relationship: visitor.relationship,
        purpose: visitor.purpose,
        vehicleRegistration: visitor.vehicleRegistration,
        checkedInAt: this.formatJohannesburgDateTime(visitor.checkedInAt),
        checkoutDueAt: this.formatJohannesburgDateTime(input.checkoutDueAt),
        recordedByName,
        notes: visitor.notes,
      }).catch((error) => this.logAsyncFailure('Could not send visitor checkout reminder', error));
    }

    await this.audit.log({
      action: 'SEND_VISITOR_CHECKOUT_REMINDER',
      entity: 'VisitorLog',
      entityId: visitor.id,
      metadata: {
        visitorName: visitor.visitorName,
        checkedInAt: visitor.checkedInAt,
        checkoutDueAt: input.checkoutDueAt,
        recipientCount: input.recipients.length,
      },
    });
  }

  private visitorCheckoutDueAt(checkedInAt: Date) {
    const parts = new Intl.DateTimeFormat('en-ZA', {
      timeZone: 'Africa/Johannesburg',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(checkedInAt);
    const year = Number(parts.find((part) => part.type === 'year')?.value);
    const month = Number(parts.find((part) => part.type === 'month')?.value);
    const day = Number(parts.find((part) => part.type === 'day')?.value);
    return new Date(Date.UTC(year, month - 1, day, 20, 0, 0, 0));
  }

  private visitorCheckoutSweepIntervalMs() {
    return Number(process.env.VISITOR_CHECKOUT_REMINDER_SWEEP_MS ?? 60000);
  }

  private async notifySecurityVisitorPreRegistrationSubmitted(preRegistration: {
    id: string;
    visitorName: string;
    visitorPhone?: string | null;
    visitorIdNumber?: string | null;
    relationship: string;
    expectedVisitDate: Date;
    expectedArrivalTime: string;
    vehicleRegistration?: string | null;
    notes?: string | null;
    user: {
      firstName?: string | null;
      lastName?: string | null;
      email?: string | null;
      studentProfile?: { studentNumber?: string | null } | null;
    };
    residence?: { name: string } | null;
    room?: { name: string; roomNumber: number } | null;
  }) {
    const recipients = await this.activeSecurityNotificationRecipients();
    const studentName = this.fullName(preRegistration.user);
    for (const recipient of recipients) {
      await this.notifications.visitorPreRegistrationSubmitted({
        userId: recipient.id,
        email: recipient.email,
        name: this.fullName(recipient),
        visitorName: preRegistration.visitorName,
        visitorPhone: preRegistration.visitorPhone,
        visitorIdNumber: preRegistration.visitorIdNumber,
        studentName,
        studentNumber: preRegistration.user.studentProfile?.studentNumber,
        residenceName: preRegistration.residence?.name,
        roomName: this.roomName(preRegistration.room),
        relationship: preRegistration.relationship,
        expectedVisitDate: this.formatJohannesburgDate(preRegistration.expectedVisitDate),
        expectedArrivalTime: preRegistration.expectedArrivalTime,
        vehicleRegistration: preRegistration.vehicleRegistration,
        notes: preRegistration.notes,
      }).catch((error) => this.logAsyncFailure('Could not notify security of visitor pre-registration', error));
    }
    await this.audit.log({
      action: 'SEND_VISITOR_PRE_REGISTRATION_NOTIFICATION',
      entity: 'VisitorPreRegistration',
      entityId: preRegistration.id,
      metadata: {
        visitorName: preRegistration.visitorName,
        recipientCount: recipients.length,
      },
    });
  }

  private async activeSecurityNotificationRecipients() {
    const where = {
      status: UserStatus.ACTIVE,
      roles: { some: { role: { name: RoleName.SECURITY } } },
    };
    const select = {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    };
    const loggedIn = await this.prisma.user.findMany({
      where: { ...where, refreshTokenHash: { not: null } },
      select,
    });
    if (loggedIn.length) return loggedIn;
    return this.prisma.user.findMany({ where, select });
  }

  private formatJohannesburgDateTime(value: Date) {
    return new Intl.DateTimeFormat('en-ZA', {
      timeZone: 'Africa/Johannesburg',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(value);
  }

  private formatJohannesburgDate(value: Date) {
    return new Intl.DateTimeFormat('en-ZA', {
      timeZone: 'Africa/Johannesburg',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(value);
  }

  private roomName(room?: { name?: string | null; roomNumber?: number | null } | null) {
    return room?.name ?? (room?.roomNumber ? `Room ${room.roomNumber}` : undefined);
  }

  private clean(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private logAsyncFailure(message: string, error: unknown) {
    this.logger.error(message, error instanceof Error ? error.stack : String(error));
  }

  private readonly preRegistrationInclude = {
    user: {
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        studentProfile: { select: { studentNumber: true } },
      },
    },
    residence: { select: { id: true, name: true, address: true } },
    room: { select: { id: true, name: true, roomNumber: true } },
    visitorLog: { select: { id: true, checkedInAt: true, checkedOutAt: true } },
  } as const;

  private readonly visitorInclude = {
    residence: { select: { id: true, name: true, address: true } },
    room: { select: { id: true, name: true, roomNumber: true } },
    user: {
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        studentProfile: { select: { studentNumber: true, profileImageUploadedAt: true } },
      },
    },
    preRegistration: { select: { id: true, status: true, expectedVisitDate: true, expectedArrivalTime: true } },
    recordedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
    checkedOutBy: { select: { id: true, email: true, firstName: true, lastName: true } },
    overrideBy: { select: { id: true, email: true, firstName: true, lastName: true } },
  } as const;
}
