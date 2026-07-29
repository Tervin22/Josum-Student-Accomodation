import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApplicationStatus, MaintenanceStatus, StorageRequestStatus } from '@prisma/client';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async listForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(userId: string, id: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
  }

  async applicationSubmitted(input: {
    userId: string;
    email: string;
    name: string;
    referenceCode: string;
    residenceName: string;
    residenceAddress: string;
  }) {
    await this.prisma.notification.create({
      data: {
        userId: input.userId,
        title: 'Application submitted',
        body: `Application ${input.referenceCode} for ${input.residenceName} has been submitted.`,
      },
    });
    await this.mail.sendTemplate(input.email, 'application-submitted', input);
  }

  async documentsRequired(input: {
    userId: string;
    email: string;
    name: string;
    referenceCode: string;
    residenceName?: string;
    residenceAddress?: string;
  }) {
    await this.prisma.notification.create({
      data: {
        userId: input.userId,
        title: 'Documents required',
        body: `Application ${input.referenceCode} needs supporting documents before it can be reviewed.`,
      },
    });
    await this.mail.sendTemplate(input.email, 'documents-required', {
      ...input,
      appUrl: this.appUrl(),
    });
  }

  async applicationStatusChanged(input: {
    userId: string;
    email: string;
    name: string;
    referenceCode: string;
    fromStatus?: ApplicationStatus;
    toStatus: ApplicationStatus;
    note?: string;
    residenceName: string;
    residenceAddress: string;
  }) {
    const toStatus = this.formatStatus(input.toStatus);
    const emailContent = this.statusEmailContent(input.toStatus, {
      name: this.fallback(input.name, 'Student'),
      referenceCode: this.fallback(input.referenceCode, 'your application'),
      residenceName: input.residenceName,
      toStatus,
    });
    await this.prisma.notification.create({
      data: {
        userId: input.userId,
        title: emailContent.notificationTitle,
        body: `Application ${this.fallback(input.referenceCode, 'reference not captured')} moved to ${toStatus}.`,
      },
    });
    await this.mail.sendTemplate(input.email, 'application-status-changed', {
      ...input,
      name: this.fallback(input.name, 'Student'),
      referenceCode: this.fallback(input.referenceCode, 'Not captured'),
      fromStatus: input.fromStatus ? this.formatStatus(input.fromStatus) : 'New',
      toStatus,
      residenceName: input.residenceName,
      residenceAddress: input.residenceAddress,
      appUrl: this.appUrl(),
      statusSubject: emailContent.subject,
      openingMessage: emailContent.openingMessage,
      detailMessage: emailContent.detailMessage,
      nextStepMessage: emailContent.nextStepMessage,
      studentNoteBlock: this.studentNoteBlock(input.note),
    });
  }

  async maintenanceSubmitted(input: { userId: string; email: string; name: string; referenceCode: string; title: string }) {
    await this.prisma.notification.create({
      data: {
        userId: input.userId,
        title: 'Maintenance request submitted',
        body: `Maintenance request ${input.referenceCode} has been submitted.`,
      },
    });
    await this.mail.sendTemplate(input.email, 'maintenance-submitted', input);
  }

  async maintenanceResolved(input: {
    userId: string;
    email: string;
    name: string;
    referenceCode: string;
    title: string;
    resolutionNote: string;
  }) {
    await this.prisma.notification.create({
      data: {
        userId: input.userId,
        title: 'Maintenance request resolved',
        body: `Maintenance request ${input.referenceCode} has been resolved.`,
      },
    });
    await this.mail.sendTemplate(input.email, 'maintenance-resolved', input);
  }

  async maintenanceStatusChanged(input: {
    userId: string;
    email: string;
    name: string;
    referenceCode: string;
    title: string;
    fromStatus?: MaintenanceStatus;
    toStatus: MaintenanceStatus;
    administratorName?: string;
    resolutionNote?: string;
  }) {
    const toStatus = this.formatStatus(input.toStatus);
    const administratorName = this.fallback(input.administratorName, 'the administration team');
    const emailContent = this.maintenanceStatusEmailContent(input.toStatus, {
      referenceCode: this.fallback(input.referenceCode, 'your request'),
      title: this.fallback(input.title, 'Maintenance request'),
      administratorName,
    });

    await this.prisma.notification.create({
      data: {
        userId: input.userId,
        title: emailContent.notificationTitle,
        body: `Maintenance request ${this.fallback(input.referenceCode, 'reference not captured')} moved to ${toStatus}.`,
      },
    });
    await this.mail.sendTemplate(input.email, 'maintenance-status-changed', {
      ...input,
      name: this.fallback(input.name, 'Student'),
      referenceCode: this.fallback(input.referenceCode, 'Not captured'),
      title: this.fallback(input.title, 'Maintenance request'),
      fromStatus: input.fromStatus ? this.formatStatus(input.fromStatus) : 'New',
      toStatus,
      administratorName,
      appUrl: this.appUrl(),
      maintenanceStatusSubject: emailContent.subject,
      maintenanceOpeningMessage: emailContent.openingMessage,
      maintenanceDetailMessage: emailContent.detailMessage,
      resolutionNoteBlock: this.resolutionNoteBlock(input.resolutionNote),
    });
  }

  async maintenanceSlaReminder(input: {
    userId: string;
    email: string;
    name: string;
    referenceCode: string;
    title: string;
    priority: string;
    deadline: string;
    type: 'ACKNOWLEDGEMENT' | 'RESOLUTION';
  }) {
    const acknowledgement = input.type === 'ACKNOWLEDGEMENT';
    const subject = acknowledgement
      ? `Maintenance request ${input.referenceCode} acknowledgement SLA breached`
      : `Maintenance request ${input.referenceCode} resolution SLA breached`;
    const message = acknowledgement
      ? 'A maintenance request has breached the acknowledgement SLA and needs technician attention.'
      : 'A maintenance request has breached the resolution SLA and needs follow-up from the assigned technician.';

    await this.prisma.notification.create({
      data: {
        userId: input.userId,
        title: acknowledgement ? 'Maintenance acknowledgement SLA breached' : 'Maintenance resolution SLA breached',
        body: `Maintenance request ${input.referenceCode} requires attention. Deadline: ${input.deadline}.`,
      },
    });
    await this.mail.sendTemplate(input.email, 'maintenance-sla-reminder', {
      ...input,
      name: this.fallback(input.name, 'Maintenance team'),
      slaSubject: subject,
      slaMessage: message,
      appUrl: this.appUrl(),
    });
  }

  async storageRequestSubmitted(input: { userId: string; email: string; name: string; referenceCode: string }) {
    await this.prisma.notification.create({
      data: {
        userId: input.userId,
        title: 'Storage request submitted',
        body: `Storage request ${input.referenceCode} has been submitted for review.`,
      },
    });
    await this.mail.sendTemplate(input.email, 'storage-request-submitted', {
      ...input,
      name: this.fallback(input.name, 'Student'),
      appUrl: this.appUrl(),
    });
  }

  async storageRequestStatusChanged(input: {
    userId: string;
    email: string;
    name: string;
    referenceCode: string;
    toStatus: StorageRequestStatus;
    reviewNotes?: string | null;
  }) {
    const status = this.formatStorageStatus(input.toStatus);
    await this.prisma.notification.create({
      data: {
        userId: input.userId,
        title: `Storage request ${status}`,
        body: `Storage request ${input.referenceCode} moved to ${status}.`,
      },
    });
    await this.mail.sendTemplate(input.email, 'storage-request-status-changed', {
      ...input,
      name: this.fallback(input.name, 'Student'),
      toStatus: status,
      reviewNoteBlock: this.studentNoteBlock(input.reviewNotes ?? undefined),
      appUrl: this.appUrl(),
    });
  }

  async visitorCheckoutOverdueReminder(input: {
    userId: string;
    email: string;
    name: string;
    visitorName: string;
    visitorPhone?: string | null;
    visitorIdNumber?: string | null;
    residentName?: string | null;
    studentNumber?: string | null;
    residenceName?: string | null;
    roomName?: string | null;
    relationship?: string | null;
    purpose?: string | null;
    vehicleRegistration?: string | null;
    checkedInAt: string;
    checkoutDueAt: string;
    recordedByName?: string | null;
    notes?: string | null;
  }) {
    await this.prisma.notification.create({
      data: {
        userId: input.userId,
        title: 'Visitor checkout overdue',
        body: `${this.fallback(input.visitorName, 'Visitor')} has not been checked out by 10:00 PM.`,
      },
    });
    await this.mail.sendTemplate(input.email, 'visitor-checkout-overdue', {
      ...input,
      name: this.fallback(input.name, 'Security team'),
      visitorName: this.fallback(input.visitorName, 'Not captured'),
      visitorPhone: this.fallback(input.visitorPhone, 'Not captured'),
      visitorIdNumber: this.fallback(input.visitorIdNumber, 'Not captured'),
      residentName: this.fallback(input.residentName, 'Not captured'),
      studentNumber: this.fallback(input.studentNumber, 'Not captured'),
      residenceName: this.fallback(input.residenceName, 'Not captured'),
      roomName: this.fallback(input.roomName, 'Not captured'),
      relationship: this.fallback(input.relationship, 'Not captured'),
      purpose: this.fallback(input.purpose, 'Not captured'),
      vehicleRegistration: this.fallback(input.vehicleRegistration, 'Not captured'),
      recordedByName: this.fallback(input.recordedByName, 'Not captured'),
      notes: this.fallback(input.notes, 'None'),
      appUrl: this.appUrl(),
    });
  }

  async visitorPreRegistrationSubmitted(input: {
    userId: string;
    email: string;
    name: string;
    visitorName: string;
    visitorPhone?: string | null;
    visitorIdNumber?: string | null;
    studentName: string;
    studentNumber?: string | null;
    residenceName?: string | null;
    roomName?: string | null;
    relationship: string;
    expectedVisitDate: string;
    expectedArrivalTime: string;
    vehicleRegistration?: string | null;
    notes?: string | null;
  }) {
    await this.prisma.notification.create({
      data: {
        userId: input.userId,
        title: 'Visitor pre-registration awaiting approval',
        body: `${this.fallback(input.studentName, 'A student')} submitted ${this.fallback(input.visitorName, 'a visitor')} for security approval.`,
      },
    });
    await this.mail.sendTemplate(input.email, 'visitor-pre-registration-submitted', {
      ...input,
      name: this.fallback(input.name, 'Security team'),
      visitorName: this.fallback(input.visitorName, 'Not captured'),
      visitorPhone: this.fallback(input.visitorPhone, 'Not captured'),
      visitorIdNumber: this.fallback(input.visitorIdNumber, 'Not captured'),
      studentName: this.fallback(input.studentName, 'Not captured'),
      studentNumber: this.fallback(input.studentNumber, 'Not captured'),
      residenceName: this.fallback(input.residenceName, 'Not captured'),
      roomName: this.fallback(input.roomName, 'Not captured'),
      relationship: this.fallback(input.relationship, 'Not captured'),
      vehicleRegistration: this.fallback(input.vehicleRegistration, 'Not captured'),
      notes: this.fallback(input.notes, 'None'),
      appUrl: this.appUrl(),
    });
  }

  async visitorPreRegistrationStatusChanged(input: {
    userId: string;
    email: string;
    name: string;
    visitorName: string;
    status: string;
    expectedVisitDate: string;
    expectedArrivalTime: string;
    residenceName?: string | null;
    roomName?: string | null;
    note?: string | null;
  }) {
    const status = this.formatPlainStatus(input.status);
    await this.prisma.notification.create({
      data: {
        userId: input.userId,
        title: `Visitor pre-registration ${status}`,
        body: `Your visitor pre-registration for ${this.fallback(input.visitorName, 'the visitor')} was ${status}.`,
      },
    });
    await this.mail.sendTemplate(input.email, 'visitor-pre-registration-status-changed', {
      ...input,
      name: this.fallback(input.name, 'Student'),
      visitorName: this.fallback(input.visitorName, 'Not captured'),
      status,
      residenceName: this.fallback(input.residenceName, 'Not captured'),
      roomName: this.fallback(input.roomName, 'Not captured'),
      noteBlock: this.studentNoteBlock(input.note ?? undefined),
      appUrl: this.appUrl(),
    });
  }

  private appUrl() {
    return this.config.get<string>('PUBLIC_APP_URL') ?? 'http://localhost:3000';
  }

  private fallback(value: string | undefined | null, fallbackValue: string) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : fallbackValue;
  }

  private formatStatus(status: ApplicationStatus | MaintenanceStatus) {
    return status
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private formatStorageStatus(status: StorageRequestStatus) {
    return this.formatPlainStatus(status);
  }

  private formatPlainStatus(status: string) {
    return status
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private statusEmailContent(
    status: ApplicationStatus,
    input: { name: string; referenceCode: string; residenceName: string; toStatus: string },
  ) {
    switch (status) {
      case ApplicationStatus.APPROVED:
        return {
          subject: `Congratulations ${input.name}, your application ${input.referenceCode} has been approved`,
          notificationTitle: 'Application approved',
          openingMessage: `Congratulations, ${input.name}. We are pleased to let you know that your accommodation application has been approved.`,
          detailMessage: `Your application for ${input.residenceName} has been reviewed successfully. Your current application status is ${input.toStatus}.`,
          nextStepMessage:
            'The administration team will contact you with the next steps for room reservation, quotation, payment arrangements, and any remaining documentation required before occupation.',
        };
      case ApplicationStatus.REJECTED:
        return {
          subject: `Application ${input.referenceCode} update: not approved`,
          notificationTitle: 'Application not approved',
          openingMessage: `Dear ${input.name}, thank you for applying for accommodation with ${input.residenceName}.`,
          detailMessage:
            'After review, we regret to inform you that your application was not approved at this time. We understand this may be disappointing, and we appreciate the time you took to complete your application.',
          nextStepMessage:
            'Please sign in to view the update. If a public note was added by the administration team, it is included below for your guidance.',
        };
      case ApplicationStatus.WAITLISTED:
        return {
          subject: `Application ${input.referenceCode} has been waitlisted`,
          notificationTitle: 'Application waitlisted',
          openingMessage: `Hello ${input.name}, your accommodation application has been reviewed and placed on the waiting list.`,
          detailMessage: `Your current status for ${input.residenceName} is ${input.toStatus}. This usually means your application is still active, but placement depends on room availability.`,
          nextStepMessage:
            'The administration team will contact you if suitable accommodation becomes available or if further information is required.',
        };
      case ApplicationStatus.UNDER_REVIEW:
        return {
          subject: `Application ${input.referenceCode} is under review`,
          notificationTitle: 'Application under review',
          openingMessage: `Hello ${input.name}, your accommodation application is now under review.`,
          detailMessage: `The administration team is reviewing your submitted information and supporting documents for ${input.residenceName}.`,
          nextStepMessage:
            'No action is required unless the team contacts you. Please keep an eye on your email for any further updates or document requests.',
        };
      case ApplicationStatus.CANCELLED:
        return {
          subject: `Application ${input.referenceCode} has been cancelled`,
          notificationTitle: 'Application cancelled',
          openingMessage: `Hello ${input.name}, this is to confirm that your accommodation application has been cancelled.`,
          detailMessage: `The current status for application ${input.referenceCode} is ${input.toStatus}.`,
          nextStepMessage:
            'If you believe this cancellation was made in error, please contact the administration team for assistance.',
        };
      case ApplicationStatus.MOVED_OUT:
        return {
          subject: `Accommodation record ${input.referenceCode} updated`,
          notificationTitle: 'Accommodation record updated',
          openingMessage: `Hello ${input.name}, your accommodation record has been updated.`,
          detailMessage: `Your record for ${input.residenceName} is now marked as ${input.toStatus}.`,
          nextStepMessage:
            'Please contact the administration team if you need any final confirmation documents or have questions about this update.',
        };
      case ApplicationStatus.SUBMITTED:
      default:
        return {
          subject: `Application ${input.referenceCode} received and pending review`,
          notificationTitle: 'Application pending review',
          openingMessage: `Hello ${input.name}, your accommodation application has been received.`,
          detailMessage: `Your application for ${input.residenceName} is currently marked as ${input.toStatus}.`,
          nextStepMessage:
            'The administration team will review your details and supporting documents. You will receive another email when there is a new update.',
        };
    }
  }

  private studentNoteBlock(note?: string) {
    const trimmed = note?.trim();
    return trimmed ? `\n\nMessage from the administration team:\n${trimmed}` : '';
  }

  private maintenanceStatusEmailContent(
    status: MaintenanceStatus,
    input: { referenceCode: string; title: string; administratorName: string },
  ) {
    switch (status) {
      case MaintenanceStatus.ACKNOWLEDGED:
        return {
          subject: `Maintenance request ${input.referenceCode} acknowledged`,
          notificationTitle: 'Maintenance request acknowledged',
          openingMessage: `Your maintenance request has been acknowledged by ${input.administratorName}.`,
          detailMessage:
            'The administration team has received your complaint and confirmed that it is now in the maintenance workflow. You will be notified when it moves to the next stage.',
        };
      case MaintenanceStatus.IN_PROGRESS:
        return {
          subject: `Maintenance request ${input.referenceCode} is in progress`,
          notificationTitle: 'Maintenance request in progress',
          openingMessage: `Your maintenance request is now in progress and is being handled by ${input.administratorName}.`,
          detailMessage:
            'The team is working on the reported issue. Please keep the affected area accessible where possible and watch for further updates.',
        };
      case MaintenanceStatus.RESOLVED:
        return {
          subject: `Maintenance request ${input.referenceCode} resolved`,
          notificationTitle: 'Maintenance request resolved',
          openingMessage: `Your maintenance request has been marked as resolved by ${input.administratorName}.`,
          detailMessage:
            'The administration team has completed the resolution step for this request. Please review the resolution note below where provided.',
        };
      case MaintenanceStatus.CLOSED:
        return {
          subject: `Maintenance request ${input.referenceCode} closed`,
          notificationTitle: 'Maintenance request closed',
          openingMessage: `Your maintenance request has been closed by ${input.administratorName}.`,
          detailMessage:
            'This request is no longer active. Please submit a new maintenance request if a new issue appears or if further assistance is needed.',
        };
      case MaintenanceStatus.OPEN:
      default:
        return {
          subject: `Maintenance request ${input.referenceCode} updated`,
          notificationTitle: 'Maintenance request updated',
          openingMessage: `Your maintenance request has been updated by ${input.administratorName}.`,
          detailMessage:
            'The administration team has updated your request. You will receive another notification when it moves to the next workflow stage.',
        };
    }
  }

  private resolutionNoteBlock(note?: string) {
    const trimmed = note?.trim();
    return trimmed ? `\n\nResolution note:\n${trimmed}` : '';
  }
}
