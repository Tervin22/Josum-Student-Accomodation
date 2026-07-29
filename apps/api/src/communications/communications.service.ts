import { BadRequestException, Injectable } from '@nestjs/common';
import { ApplicationStatus, Prisma, UserStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommunicationDto } from './dto/create-communication.dto';
import { ListCommunicationsDto } from './dto/list-communications.dto';

type ResidentRecipient = {
  userId: string;
  email: string;
  name: string;
};

@Injectable()
export class CommunicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListCommunicationsDto) {
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.CommunicationWhereInput = {
      ...(query.residenceId ? { residenceId: query.residenceId } : {}),
      ...(query.search
        ? {
            OR: [
              { subject: { contains: query.search, mode: 'insensitive' } },
              { message: { contains: query.search, mode: 'insensitive' } },
              { type: { contains: query.search, mode: 'insensitive' } },
              { residence: { is: { name: { contains: query.search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.communication.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          residence: { select: { id: true, name: true } },
          sentBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.communication.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  async send(actorId: string, dto: CreateCommunicationDto) {
    if (dto.residenceId) {
      const residence = await this.prisma.residence.findUnique({ where: { id: dto.residenceId }, select: { id: true } });
      if (!residence) {
        throw new BadRequestException('Selected accommodation was not found');
      }
    }

    const recipients = await this.resolveRecipients(dto.residenceId);
    const deliveryResults = await this.sendInBatches(recipients, dto);
    const successCount = deliveryResults.filter((item) => item === 'SENT').length;
    const failedCount = deliveryResults.length - successCount;

    const communication = await this.prisma.communication.create({
      data: {
        type: dto.type,
        subject: dto.subject.trim(),
        message: dto.message.trim(),
        residenceId: dto.residenceId,
        sentById: actorId,
        recipientCount: recipients.length,
        successCount,
        failedCount,
      },
      include: {
        residence: { select: { id: true, name: true } },
        sentBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    await this.audit.log({
      actorId,
      action: 'SEND_MAINTENANCE_COMMUNICATION',
      entity: 'Communication',
      entityId: communication.id,
      metadata: {
        type: communication.type,
        residenceId: communication.residenceId,
        recipientCount: communication.recipientCount,
        successCount,
        failedCount,
      },
    });

    return communication;
  }

  private async resolveRecipients(residenceId?: string): Promise<ResidentRecipient[]> {
    const applications = await this.prisma.application.findMany({
      where: {
        status: ApplicationStatus.APPROVED,
        acceptedAt: { not: null },
        roomId: { not: null },
        cancelledAt: null,
        ...(residenceId ? { residenceId } : {}),
        user: {
          status: UserStatus.ACTIVE,
          email: { not: '' },
        },
      },
      select: {
        userId: true,
        applicantFirstName: true,
        applicantLastName: true,
        user: { select: { email: true, firstName: true, lastName: true } },
      },
    });

    const unique = new Map<string, ResidentRecipient>();
    for (const application of applications) {
      const email = application.user.email.trim().toLowerCase();
      if (!email || unique.has(email)) continue;
      const name =
        `${application.user.firstName} ${application.user.lastName}`.trim() ||
        `${application.applicantFirstName} ${application.applicantLastName}`.trim() ||
        email;
      unique.set(email, { userId: application.userId, email, name });
    }
    return [...unique.values()];
  }

  private async sendInBatches(recipients: ResidentRecipient[], dto: CreateCommunicationDto) {
    const statuses: string[] = [];
    for (let index = 0; index < recipients.length; index += 25) {
      const batch = recipients.slice(index, index + 25);
      const results = await Promise.all(
        batch.map((recipient) =>
          this.mail.sendTemplate(recipient.email, 'maintenance-communication', {
            name: recipient.name,
            communicationType: this.formatType(dto.type),
            subject: dto.subject.trim(),
            message: dto.message.trim(),
          }),
        ),
      );
      statuses.push(...results.map((result) => result.status));
    }
    return statuses;
  }

  private formatType(value: string) {
    return value
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
