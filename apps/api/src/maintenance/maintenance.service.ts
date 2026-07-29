import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MaintenancePriority, MaintenanceStatus, Prisma, RoleName, UserStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMaintenanceRequestDto } from './dto/create-maintenance-request.dto';
import { ListMaintenanceRequestsDto } from './dto/list-maintenance-requests.dto';
import { UpdateMaintenanceRequestDto } from './dto/update-maintenance-request.dto';

@Injectable()
export class MaintenanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MaintenanceService.name);
  private slaSweep?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
      return;
    }
    this.slaSweep = setInterval(() => {
      void this.syncOpenSlaBreaches().catch((error) => this.logAsyncFailure('Could not update maintenance SLA state', error));
    }, this.slaSweepIntervalMs());
    this.slaSweep.unref?.();
  }

  onModuleDestroy() {
    if (this.slaSweep) {
      clearInterval(this.slaSweep);
    }
  }

  async create(userId: string, dto: CreateMaintenanceRequestDto) {
    if (dto.roomTypeId) {
      const roomType = await this.prisma.roomType.findUnique({ where: { id: dto.roomTypeId } });
      if (!roomType) {
        throw new NotFoundException('Selected room type was not found');
      }
    }

    const now = new Date();
    const priority = dto.priority ?? MaintenancePriority.MEDIUM;
    const request = await this.prisma.maintenanceRequest.create({
      data: {
        referenceCode: this.referenceCode(),
        userId,
        roomTypeId: dto.roomTypeId,
        category: dto.category,
        priority,
        location: this.clean(dto.location),
        title: dto.title.trim(),
        description: dto.description.trim(),
        acknowledgementDeadlineAt: this.addHours(now, this.acknowledgementSlaHours()),
        slaStatus: 'ACK_PENDING',
      },
      include: this.maintenanceInclude,
    });

    void this.notifications.maintenanceSubmitted({
      userId,
      email: request.user.email,
      name: this.fullName(request.user),
      referenceCode: request.referenceCode,
      title: request.title,
    }).catch((error) => this.logAsyncFailure('Could not send maintenance submission notification', error));
    await this.audit.log({
      actorId: userId,
      action: 'CREATE_MAINTENANCE_REQUEST',
      entity: 'MaintenanceRequest',
      entityId: request.id,
      metadata: { referenceCode: request.referenceCode, category: request.category, priority: request.priority },
    });

    return request;
  }

  async listMine(userId: string) {
    await this.syncOpenSlaBreaches();
    return this.prisma.maintenanceRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: this.maintenanceInclude,
    });
  }

  async listAdmin(query: ListMaintenanceRequestsDto) {
    await this.syncOpenSlaBreaches();
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.MaintenanceRequestWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.search
        ? {
            OR: [
              { referenceCode: { contains: query.search, mode: 'insensitive' } },
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
              { location: { contains: query.search, mode: 'insensitive' } },
              { user: { email: { contains: query.search, mode: 'insensitive' } } },
              { user: { firstName: { contains: query.search, mode: 'insensitive' } } },
              { user: { lastName: { contains: query.search, mode: 'insensitive' } } },
              { roomType: { roomTypeName: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.maintenanceRequest.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        include: this.maintenanceInclude,
      }),
      this.prisma.maintenanceRequest.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  async getAdmin(id: string) {
    await this.syncOpenSlaBreaches();
    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id },
      include: this.maintenanceInclude,
    });
    if (!request) {
      throw new NotFoundException('Maintenance request not found');
    }
    return request;
  }

  async updateAdmin(actorId: string, id: string, dto: UpdateMaintenanceRequestDto) {
    const before = await this.prisma.maintenanceRequest.findUnique({
      where: { id },
      include: this.maintenanceInclude,
    });
    if (!before) {
      throw new NotFoundException('Maintenance request not found');
    }
    const actor = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { firstName: true, lastName: true, email: true },
    });

    const now = new Date();
    const nextStatus = dto.status ?? before.status;
    const nextResolutionNote = this.clean(dto.resolutionNote) ?? before.resolutionNote;
    if ((nextStatus === MaintenanceStatus.RESOLVED || nextStatus === MaintenanceStatus.CLOSED) && !nextResolutionNote) {
      throw new BadRequestException('A resolution note is required before resolving or closing a maintenance request');
    }
    const acknowledgementDeadlineAt = before.acknowledgementDeadlineAt ?? this.addHours(before.createdAt, this.acknowledgementSlaHours());
    const startsResolutionTimer = nextStatus !== MaintenanceStatus.OPEN;
    const acknowledgedAt = before.acknowledgedAt ?? (startsResolutionTimer ? now : null);
    const resolutionDeadlineAt = before.resolutionDeadlineAt
      ?? (acknowledgedAt ? this.addHours(acknowledgedAt, this.resolutionSlaHours(before.priority)) : null);
    const resolved = nextStatus === MaintenanceStatus.RESOLVED || nextStatus === MaintenanceStatus.CLOSED;
    const slaSnapshot = this.calculateSlaSnapshot({
      status: nextStatus,
      acknowledgementDeadlineAt,
      acknowledgedAt,
      resolutionDeadlineAt,
      resolvedAt: resolved ? before.resolvedAt ?? now : before.resolvedAt,
      slaAcknowledgementBreachedAt: before.slaAcknowledgementBreachedAt,
      slaResolutionBreachedAt: before.slaResolutionBreachedAt,
    }, now);

    const request = await this.prisma.maintenanceRequest.update({
      where: { id },
      data: {
        status: nextStatus,
        acknowledgementDeadlineAt,
        acknowledgedAt,
        acknowledgedById: before.acknowledgedById ?? (startsResolutionTimer ? actorId : undefined),
        assignedTechnicianId: before.assignedTechnicianId ?? (startsResolutionTimer ? actorId : undefined),
        resolutionDeadlineAt,
        resolutionNote: dto.resolutionNote !== undefined ? this.clean(dto.resolutionNote) : before.resolutionNote,
        resolvedAt: resolved ? before.resolvedAt ?? now : before.resolvedAt,
        resolvedById: resolved ? actorId : before.resolvedById,
        slaAcknowledgementBreachedAt: slaSnapshot.slaAcknowledgementBreachedAt,
        slaResolutionBreachedAt: slaSnapshot.slaResolutionBreachedAt,
        slaStatus: slaSnapshot.slaStatus,
      },
      include: this.maintenanceInclude,
    });

    const statusChanged = before.status !== request.status;
    const resolutionChanged = nextStatus === MaintenanceStatus.RESOLVED
      && (before.status !== MaintenanceStatus.RESOLVED || before.resolutionNote !== request.resolutionNote);
    if (statusChanged || resolutionChanged) {
      void this.notifications.maintenanceStatusChanged({
        userId: request.userId,
        email: request.user.email,
        name: this.fullName(request.user),
        referenceCode: request.referenceCode,
        title: request.title,
        fromStatus: before.status,
        toStatus: request.status,
        administratorName: actor ? this.fullName(actor) || actor.email : 'Administration team',
        resolutionNote: request.resolutionNote ?? '',
      }).catch((error) => this.logAsyncFailure('Could not send maintenance status notification', error));
    }

    await this.audit.log({
      actorId,
      action: 'UPDATE_MAINTENANCE_REQUEST',
      entity: 'MaintenanceRequest',
      entityId: id,
      metadata: {
        fromStatus: before.status,
        toStatus: request.status,
        slaStatus: request.slaStatus,
        acknowledgementDeadlineAt: request.acknowledgementDeadlineAt,
        resolutionDeadlineAt: request.resolutionDeadlineAt,
        assignedTechnicianId: request.assignedTechnicianId,
        resolutionNote: request.resolutionNote,
      },
    });

    return request;
  }

  private referenceCode() {
    return `MNT-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`;
  }

  private clean(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private fullName(user: { firstName: string; lastName: string }) {
    return `${user.firstName} ${user.lastName}`.trim();
  }

  private logAsyncFailure(message: string, error: unknown) {
    this.logger.error(message, error instanceof Error ? error.stack : String(error));
  }

  private async syncOpenSlaBreaches() {
    const now = new Date();
    await Promise.all([
      this.prisma.maintenanceRequest.updateMany({
        where: {
          status: MaintenanceStatus.OPEN,
          acknowledgementDeadlineAt: { lte: now },
          slaAcknowledgementBreachedAt: null,
        },
        data: {
          slaAcknowledgementBreachedAt: now,
          slaStatus: 'ACK_BREACHED',
        },
      }),
      this.prisma.maintenanceRequest.updateMany({
        where: {
          status: { in: [MaintenanceStatus.ACKNOWLEDGED, MaintenanceStatus.IN_PROGRESS] },
          resolutionDeadlineAt: { lte: now },
          slaResolutionBreachedAt: null,
        },
        data: {
          slaResolutionBreachedAt: now,
          slaStatus: 'RESOLUTION_BREACHED',
        },
      }),
      this.prisma.maintenanceRequest.updateMany({
        where: {
          status: { in: [MaintenanceStatus.RESOLVED, MaintenanceStatus.CLOSED] },
          NOT: { slaStatus: 'RESOLVED' },
        },
        data: { slaStatus: 'RESOLVED' },
      }),
    ]);
    await this.sendSlaBreachReminders(now);
  }

  private async sendSlaBreachReminders(now: Date) {
    const [ackBreaches, resolutionBreaches, technicians] = await Promise.all([
      this.prisma.maintenanceRequest.findMany({
        where: {
          status: MaintenanceStatus.OPEN,
          slaStatus: 'ACK_BREACHED',
          acknowledgementSlaReminderSentAt: null,
        },
        take: 50,
        orderBy: { acknowledgementDeadlineAt: 'asc' },
      }),
      this.prisma.maintenanceRequest.findMany({
        where: {
          status: { in: [MaintenanceStatus.ACKNOWLEDGED, MaintenanceStatus.IN_PROGRESS] },
          slaStatus: 'RESOLUTION_BREACHED',
          resolutionSlaReminderSentAt: null,
        },
        take: 50,
        orderBy: { resolutionDeadlineAt: 'asc' },
        include: {
          assignedTechnician: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          acknowledgedBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.activeTechnicians(),
    ]);

    for (const request of ackBreaches) {
      if (!technicians.length) continue;
      const claimed = await this.prisma.maintenanceRequest.updateMany({
        where: { id: request.id, acknowledgementSlaReminderSentAt: null },
        data: { acknowledgementSlaReminderSentAt: now },
      });
      if (!claimed.count) continue;
      await this.sendSlaReminder({
        recipients: technicians,
        request,
        type: 'ACKNOWLEDGEMENT',
        deadline: request.acknowledgementDeadlineAt,
      });
    }

    for (const request of resolutionBreaches) {
      const recipients = this.resolutionSlaRecipients(request, technicians);
      if (!recipients.length) continue;
      const claimed = await this.prisma.maintenanceRequest.updateMany({
        where: { id: request.id, resolutionSlaReminderSentAt: null },
        data: { resolutionSlaReminderSentAt: now },
      });
      if (!claimed.count) continue;
      await this.sendSlaReminder({
        recipients,
        request,
        type: 'RESOLUTION',
        deadline: request.resolutionDeadlineAt,
      });
    }
  }

  private resolutionSlaRecipients(
    request: {
      assignedTechnician?: { id: string; email: string; firstName: string; lastName: string } | null;
      acknowledgedBy?: { id: string; email: string; firstName: string; lastName: string } | null;
    },
    fallbackTechnicians: Array<{ id: string; email: string; firstName: string; lastName: string }>,
  ) {
    const recipients = new Map<string, { id: string; email: string; firstName: string; lastName: string }>();
    if (request.acknowledgedBy) recipients.set(request.acknowledgedBy.id, request.acknowledgedBy);
    if (request.assignedTechnician) recipients.set(request.assignedTechnician.id, request.assignedTechnician);
    if (!recipients.size) fallbackTechnicians.forEach((technician) => recipients.set(technician.id, technician));
    return Array.from(recipients.values());
  }

  private async sendSlaReminder(input: {
    recipients: Array<{ id: string; email: string; firstName: string; lastName: string }>;
    request: {
      id: string;
      referenceCode: string;
      title: string;
      priority: MaintenancePriority;
    };
    type: 'ACKNOWLEDGEMENT' | 'RESOLUTION';
    deadline?: Date | null;
  }) {
    for (const recipient of input.recipients) {
      await this.notifications.maintenanceSlaReminder({
        userId: recipient.id,
        email: recipient.email,
        name: this.fullName(recipient) || recipient.email,
        referenceCode: input.request.referenceCode,
        title: input.request.title,
        priority: input.request.priority,
        deadline: input.deadline?.toISOString() ?? 'Not set',
        type: input.type,
      }).catch((error) => this.logAsyncFailure('Could not send maintenance SLA reminder', error));
    }
    await this.audit.log({
      action: 'SEND_MAINTENANCE_SLA_REMINDER',
      entity: 'MaintenanceRequest',
      entityId: input.request.id,
      metadata: {
        type: input.type,
        referenceCode: input.request.referenceCode,
        recipientCount: input.recipients.length,
      },
    });
  }

  private activeTechnicians() {
    return this.prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        roles: { some: { role: { name: RoleName.TECHNICIAN } } },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });
  }

  private calculateSlaSnapshot(
    input: {
      status: MaintenanceStatus;
      acknowledgementDeadlineAt: Date | null;
      acknowledgedAt: Date | null;
      resolutionDeadlineAt: Date | null;
      resolvedAt: Date | null;
      slaAcknowledgementBreachedAt: Date | null;
      slaResolutionBreachedAt: Date | null;
    },
    now: Date,
  ) {
    if (input.status === MaintenanceStatus.RESOLVED || input.status === MaintenanceStatus.CLOSED || input.resolvedAt) {
      return {
        slaStatus: 'RESOLVED',
        slaAcknowledgementBreachedAt: input.slaAcknowledgementBreachedAt,
        slaResolutionBreachedAt: input.slaResolutionBreachedAt,
      };
    }
    if (!input.acknowledgedAt) {
      const breached = input.acknowledgementDeadlineAt ? input.acknowledgementDeadlineAt.getTime() <= now.getTime() : false;
      return {
        slaStatus: breached ? 'ACK_BREACHED' : 'ACK_PENDING',
        slaAcknowledgementBreachedAt: input.slaAcknowledgementBreachedAt ?? (breached ? now : null),
        slaResolutionBreachedAt: input.slaResolutionBreachedAt,
      };
    }
    const resolutionBreached = input.resolutionDeadlineAt ? input.resolutionDeadlineAt.getTime() <= now.getTime() : false;
    return {
      slaStatus: resolutionBreached ? 'RESOLUTION_BREACHED' : 'RESOLUTION_PENDING',
      slaAcknowledgementBreachedAt: input.slaAcknowledgementBreachedAt,
      slaResolutionBreachedAt: input.slaResolutionBreachedAt ?? (resolutionBreached ? now : null),
    };
  }

  private acknowledgementSlaHours() {
    return this.numberConfig('MAINTENANCE_ACK_SLA_HOURS', 24);
  }

  private resolutionSlaHours(priority: MaintenancePriority) {
    if (priority === MaintenancePriority.HIGH || priority === MaintenancePriority.URGENT) {
      return this.numberConfig('MAINTENANCE_HIGH_RESOLUTION_SLA_HOURS', 12);
    }
    return this.numberConfig('MAINTENANCE_LOW_RESOLUTION_SLA_HOURS', 48);
  }

  private numberConfig(key: string, fallback: number) {
    const value = Number(this.config.get<number | string>(key) ?? fallback);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private slaSweepIntervalMs() {
    return this.numberConfig('MAINTENANCE_SLA_SWEEP_INTERVAL_MS', 300000);
  }

  private addHours(value: Date, hours: number) {
    return new Date(value.getTime() + hours * 60 * 60 * 1000);
  }

  private readonly maintenanceInclude = {
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
    resolvedBy: {
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    },
    acknowledgedBy: {
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    },
    assignedTechnician: {
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    },
  } as const;
}
