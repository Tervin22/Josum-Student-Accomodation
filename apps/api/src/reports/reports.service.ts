import { Injectable } from '@nestjs/common';
import { ApplicationStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { FinanceReportQueryDto } from './dto/finance-report-query.dto';

const financeInclude = {
  user: {
    select: {
      email: true,
      phone: true,
      studentProfile: { select: { institution: true } },
    },
  },
  residence: { select: { id: true, name: true } },
  room: { select: { id: true, name: true, roomNumber: true } },
} as const;

type FinanceApplication = Prisma.ApplicationGetPayload<{ include: typeof financeInclude }>;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async finance(query: FinanceReportQueryDto) {
    const skip = (query.page - 1) * query.limit;
    const where = this.financeWhere(query);
    const [applications, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: [{ acceptedAt: 'desc' }, { createdAt: 'desc' }],
        include: financeInclude,
      }),
      this.prisma.application.count({ where }),
    ]);

    return {
      items: applications.map((application) => this.financeRow(application)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async financeExport(actorId: string, query: FinanceReportQueryDto) {
    const rows = await this.prisma.application.findMany({
      where: this.financeWhere(query),
      take: 10000,
      orderBy: [{ acceptedAt: 'desc' }, { createdAt: 'desc' }],
      include: financeInclude,
    });
    await this.audit.log({
      actorId,
      action: 'EXPORT_FINANCE_REPORT',
      entity: 'Application',
      metadata: {
        count: rows.length,
        residenceId: query.residenceId,
        institution: query.institution,
        fundingType: query.fundingType,
        bursary: query.bursary,
      },
    });

    const header = [
      'Full name',
      'ID number',
      'Student number',
      'Institution',
      'Funding type',
      'Name of bursary',
      'Student contact number',
      'Next of kin full name',
      'Next of kin contact number',
      'Accommodation',
      'Room number',
      'Approval date',
      'Acceptance date',
      'Residency status',
      'Email',
    ];
    const body = rows.map((application) => {
      const row = this.financeRow(application);
      return [
        row.fullName,
        row.idNumber,
        row.studentNumber,
        row.institution,
        row.fundingType,
        row.bursaryName,
        row.studentContactNumber,
        row.nextOfKinFullName,
        row.nextOfKinContactNumber,
        row.accommodation,
        row.roomNumber,
        row.approvalDate,
        row.acceptanceDate,
        row.residencyStatus,
        row.email,
      ];
    });

    return [header, ...body].map((row) => row.map((value) => this.csv(value)).join(',')).join('\n');
  }

  private financeWhere(query: FinanceReportQueryDto): Prisma.ApplicationWhereInput {
    return {
      status: ApplicationStatus.APPROVED,
      acceptedAt: { not: null },
      roomId: { not: null },
      cancelledAt: null,
      ...(query.residenceId ? { residenceId: query.residenceId } : {}),
      ...(query.institution ? { institutionName: { contains: query.institution, mode: 'insensitive' } } : {}),
      ...(query.fundingType ? { fundingType: { contains: query.fundingType, mode: 'insensitive' } } : {}),
      ...(query.bursary ? { fundingReference: { contains: query.bursary, mode: 'insensitive' } } : {}),
      ...(query.search
        ? {
            OR: [
              { applicantFirstName: { contains: query.search, mode: 'insensitive' } },
              { applicantLastName: { contains: query.search, mode: 'insensitive' } },
              { studentNumber: { contains: query.search, mode: 'insensitive' } },
              { studentIdNumber: { contains: query.search, mode: 'insensitive' } },
              { studentPhone: { contains: query.search, mode: 'insensitive' } },
              { institutionName: { contains: query.search, mode: 'insensitive' } },
              { fundingType: { contains: query.search, mode: 'insensitive' } },
              { fundingReference: { contains: query.search, mode: 'insensitive' } },
              { user: { email: { contains: query.search, mode: 'insensitive' } } },
              { residence: { name: { contains: query.search, mode: 'insensitive' } } },
              { room: { name: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
  }

  private financeRow(application: FinanceApplication) {
    return {
      applicationId: application.id,
      fullName: `${application.applicantFirstName} ${application.applicantLastName}`.trim(),
      idNumber: application.studentIdNumber,
      studentNumber: application.studentNumber,
      institution: application.institutionName ?? application.user.studentProfile?.institution ?? '',
      fundingType: application.fundingType ?? '',
      bursaryName: application.fundingReference ?? '',
      studentContactNumber: application.studentPhone || application.user.phone || '',
      nextOfKinFullName: application.nextOfKin1Name ?? '',
      nextOfKinContactNumber: application.nextOfKin1Cell ?? '',
      accommodation: application.residence?.name ?? '',
      roomNumber: application.room?.name ?? '',
      approvalDate: this.formatDate(application.approvedAt),
      acceptanceDate: this.formatDate(application.acceptedAt),
      residencyStatus: 'Active resident',
      email: application.user.email,
    };
  }

  private formatDate(value?: Date | null) {
    return value ? value.toISOString() : '';
  }

  private csv(value: string | number) {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }
}
