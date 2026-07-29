import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, RegistrationBlockIdentifierType, RoleName, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { STAFF_REGISTRATION_ROLES } from '../common/roles/role-groups';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { BootstrapAdminDto } from './dto/bootstrap-admin.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterStaffDto, StaffRegistrationRoleName } from './dto/register-staff.dto';
import { RegisterStudentDto } from './dto/register-student.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

interface SecurityContext {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
  ) {}

  async registerStudent(dto: RegisterStudentDto, context?: SecurityContext) {
    const email = this.normalizeEmail(dto.email);
    const studentNumber = this.cleanOptionalString(dto.studentNumber);
    const identifiers = this.studentRegistrationIdentifiers(dto, email, studentNumber);
    await this.assertStudentRegistrationNotBlocked(identifiers, context);

    const existing = await this.prisma.user.findUnique({
      where: { email },
      include: this.userInclude,
    });
    if (existing) {
      if (await this.canReactivateWhitelistedStudent(existing, identifiers)) {
        if (studentNumber) {
          const existingStudentNumber = await this.prisma.studentProfile.findFirst({
            where: { studentNumber, userId: { not: existing.id } },
          });
          if (existingStudentNumber) {
            throw new ConflictException('Student number is already registered');
          }
        }
        const passwordHash = await this.hashSecret(dto.password);
        return this.reactivateStudentUser(existing.id, dto, email, passwordHash, studentNumber, context);
      }
      throw new ConflictException('Email is already registered');
    }

    if (studentNumber) {
      const existingStudentNumber = await this.prisma.studentProfile.findUnique({ where: { studentNumber } });
      if (existingStudentNumber) {
        throw new ConflictException('Student number is already registered');
      }
    }

    const passwordHash = await this.hashSecret(dto.password);
    const user = await this.createStudentUser(dto, email, passwordHash, studentNumber);

    await this.mail.sendTemplate(email, 'account-created', {
      name: `${dto.firstName} ${dto.lastName}`,
      role: 'student',
      appUrl: this.appUrl(),
    });
    await this.audit.log({
      actorId: user.id,
      action: 'REGISTER_STUDENT',
      entity: 'User',
      entityId: user.id,
      metadata: { role: RoleName.STUDENT },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return this.issueTokens(user);
  }

  async registerStaff(dto: RegisterStaffDto, context?: SecurityContext) {
    const email = this.normalizeEmail(dto.email);
    const staffRole = this.toStaffRole(dto.role);
    const roleConfig = this.staffRoleConfig[staffRole];
    const configuredKey = this.config.get<string>(roleConfig.envKey);

    if (!this.registrationKeyMatches(dto.registrationKey, configuredKey)) {
      await this.audit.log({
        action: 'REGISTER_STAFF_FAILED',
        entity: 'User',
        metadata: {
          emailHash: this.sha256(email),
          role: staffRole,
          reason: configuredKey ? 'INVALID_KEY' : 'MISSING_KEY_CONFIGURATION',
        },
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });
      throw new UnauthorizedException('Invalid staff registration key');
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await this.hashSecret(dto.password);
    const user = await this.prisma.$transaction(async (tx) => {
      const role = await tx.role.upsert({
        where: { name: staffRole },
        update: {},
        create: { name: staffRole, description: roleConfig.description },
      });
      return tx.user.create({
        data: {
          email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: this.cleanOptionalString(dto.phone),
          roles: { create: { roleId: role.id } },
        },
        include: this.userInclude,
      });
    });

    await this.mail.sendTemplate(email, 'account-created', {
      name: `${dto.firstName} ${dto.lastName}`,
      role: roleConfig.mailLabel,
      appUrl: this.appUrl(),
    });
    await this.audit.log({
      actorId: user.id,
      action: 'REGISTER_STAFF',
      entity: 'User',
      entityId: user.id,
      metadata: { role: staffRole },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return this.issueTokens(user);
  }

  private async createStudentUser(dto: RegisterStudentDto, email: string, passwordHash: string, studentNumber?: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const role = await tx.role.upsert({
          where: { name: RoleName.STUDENT },
          update: {},
          create: { name: RoleName.STUDENT, description: 'Student portal user' },
        });
        return tx.user.create({
          data: {
            email,
            passwordHash,
            firstName: dto.firstName,
            lastName: dto.lastName,
            phone: this.cleanOptionalString(dto.phone),
            roles: { create: { roleId: role.id } },
            studentProfile: {
              create: {
                studentNumber,
                institution: this.cleanOptionalString(dto.institution),
                course: this.cleanOptionalString(dto.course),
                yearOfStudy: dto.yearOfStudy,
                dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
                idNumber: this.cleanOptionalString(dto.idNumber),
                address: this.cleanOptionalString(dto.address),
              },
            },
          },
          include: this.userInclude,
        });
      });
    } catch (error) {
      if (this.isUniqueConstraint(error, 'studentNumber')) {
        throw new ConflictException('Student number is already registered');
      }
      throw error;
    }
  }

  private async reactivateStudentUser(
    userId: string,
    dto: RegisterStudentDto,
    email: string,
    passwordHash: string,
    studentNumber: string | undefined,
    context?: SecurityContext,
  ) {
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: this.cleanOptionalString(dto.phone),
          status: UserStatus.ACTIVE,
          refreshTokenHash: null,
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
              },
              update: {
                studentNumber,
                institution: this.cleanOptionalString(dto.institution),
                course: this.cleanOptionalString(dto.course),
                yearOfStudy: dto.yearOfStudy,
                dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
                idNumber: this.cleanOptionalString(dto.idNumber),
                address: this.cleanOptionalString(dto.address),
              },
            },
          },
        },
        include: this.userInclude,
      });

      await this.mail.sendTemplate(email, 'account-created', {
        name: `${dto.firstName} ${dto.lastName}`,
        role: 'student',
        appUrl: this.appUrl(),
      });
      await this.audit.log({
        actorId: user.id,
        action: 'REGISTER_STUDENT_REACTIVATED',
        entity: 'User',
        entityId: user.id,
        metadata: { role: RoleName.STUDENT },
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });

      return this.issueTokens(user);
    } catch (error) {
      if (this.isUniqueConstraint(error, 'studentNumber')) {
        throw new ConflictException('Student number is already registered');
      }
      throw error;
    }
  }

  private async assertStudentRegistrationNotBlocked(
    identifiers: Array<{ type: RegistrationBlockIdentifierType; value: string }>,
    context?: SecurityContext,
  ) {
    const block = await this.prisma.studentRegistrationBlock.findFirst({
      where: {
        active: true,
        OR: identifiers.map((identifier) => ({
          identifierType: identifier.type,
          identifierNormalized: identifier.value,
        })),
      },
      select: { id: true, identifierType: true },
    });
    if (!block) return;

    await this.audit.log({
      action: 'REGISTER_STUDENT_FAILED',
      entity: 'StudentRegistrationBlock',
      entityId: block.id,
      metadata: {
        reason: 'TERMINATED_STAY_BLOCK',
        identifierType: block.identifierType,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });
    throw new ForbiddenException(
      'Your accommodation stay has been terminated. Please contact the administrator before registering again.',
    );
  }

  private async canReactivateWhitelistedStudent(
    user: {
      id: string;
      status: UserStatus;
      roles: Array<{ role: { name: RoleName } }>;
    },
    identifiers: Array<{ type: RegistrationBlockIdentifierType; value: string }>,
  ) {
    const isSuspendedStudent =
      user.status === UserStatus.SUSPENDED && user.roles.some((item) => item.role.name === RoleName.STUDENT);
    if (!isSuspendedStudent) return false;

    const whitelistCount = await this.prisma.studentRegistrationBlock.count({
      where: {
        sourceUserId: user.id,
        active: false,
        whitelistedAt: { not: null },
        OR: identifiers.map((identifier) => ({
          identifierType: identifier.type,
          identifierNormalized: identifier.value,
        })),
      },
    });
    return whitelistCount > 0;
  }

  private async hasActiveRegistrationBlockForUser(user: {
    id: string;
    email: string;
    studentProfile?: { idNumber?: string | null; studentNumber?: string | null } | null;
  }) {
    const identifiers = [
      { type: RegistrationBlockIdentifierType.EMAIL, value: this.normalizeIdentifier(RegistrationBlockIdentifierType.EMAIL, user.email) },
      {
        type: RegistrationBlockIdentifierType.ID_NUMBER,
        value: this.normalizeIdentifier(RegistrationBlockIdentifierType.ID_NUMBER, user.studentProfile?.idNumber),
      },
      {
        type: RegistrationBlockIdentifierType.STUDENT_NUMBER,
        value: this.normalizeIdentifier(RegistrationBlockIdentifierType.STUDENT_NUMBER, user.studentProfile?.studentNumber),
      },
    ].filter((identifier): identifier is { type: RegistrationBlockIdentifierType; value: string } => Boolean(identifier.value));

    return Boolean(
      await this.prisma.studentRegistrationBlock.findFirst({
        where: {
          active: true,
          OR: identifiers.map((identifier) => ({
            identifierType: identifier.type,
            identifierNormalized: identifier.value,
          })),
        },
        select: { id: true },
      }),
    );
  }

  async bootstrapAdmin(dto: BootstrapAdminDto, context?: SecurityContext) {
    const configuredToken = this.config.get<string>('INSTALLATION_ADMIN_TOKEN');
    if (!configuredToken || dto.bootstrapToken !== configuredToken) {
      throw new UnauthorizedException('Invalid installation token');
    }

    const existingAdmins = await this.prisma.userRole.count({
      where: { role: { name: RoleName.ADMINISTRATOR } },
    });
    if (existingAdmins > 0) {
      throw new ForbiddenException('Administrator bootstrap is already complete');
    }

    const email = this.normalizeEmail(dto.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await this.hashSecret(dto.password);
    const user = await this.prisma.$transaction(async (tx) => {
      const role = await tx.role.upsert({
        where: { name: RoleName.ADMINISTRATOR },
        update: {},
        create: { name: RoleName.ADMINISTRATOR, description: 'System administrator' },
      });
      return tx.user.create({
        data: {
          email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          roles: { create: { roleId: role.id } },
          administratorProfile: { create: { jobTitle: dto.jobTitle } },
        },
        include: this.userInclude,
      });
    });

    await this.mail.sendTemplate(email, 'account-created', {
      name: `${dto.firstName} ${dto.lastName}`,
      role: 'administrator',
      appUrl: this.appUrl(),
    });
    await this.audit.log({
      actorId: user.id,
      action: 'BOOTSTRAP_ADMIN',
      entity: 'User',
      entityId: user.id,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return this.issueTokens(user);
  }

  async login(dto: LoginDto, context?: SecurityContext) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: this.userInclude,
    });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      await this.audit.log({
        action: 'LOGIN_FAILED',
        entity: 'User',
        metadata: { emailHash: this.sha256(email), reason: 'INVALID_CREDENTIALS' },
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });
      throw new UnauthorizedException('Invalid email or password');
    }
    if (await this.hasActiveRegistrationBlockForUser(user)) {
      await this.audit.log({
        actorId: user.id,
        action: 'LOGIN_FAILED',
        entity: 'User',
        entityId: user.id,
        metadata: { reason: 'TERMINATED_STAY' },
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });
      throw new ForbiddenException(
        'Your accommodation stay has been terminated. Please contact the administrator before registering or signing in again.',
      );
    }
    if (user.status !== UserStatus.ACTIVE) {
      await this.audit.log({
        actorId: user.id,
        action: 'LOGIN_FAILED',
        entity: 'User',
        entityId: user.id,
        metadata: { reason: 'ACCOUNT_NOT_ACTIVE' },
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });
      throw new ForbiddenException('Account is suspended');
    }

    await this.audit.log({
      actorId: user.id,
      action: 'LOGIN_SUCCESS',
      entity: 'User',
      entityId: user.id,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; tokenType: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.tokenType !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: this.userInclude,
    });
    if (user?.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }
    if (await this.hasActiveRegistrationBlockForUser(user)) {
      throw new UnauthorizedException('Account has been terminated');
    }
    if (!user?.refreshTokenHash || !(await bcrypt.compare(refreshToken, user.refreshTokenHash))) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }
    return this.issueTokens(user);
  }

  async logout(userId: string, context?: SecurityContext) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
    await this.audit.log({
      actorId: userId,
      action: 'LOGOUT',
      entity: 'User',
      entityId: userId,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });
    return { ok: true };
  }

  async forgotPassword(dto: ForgotPasswordDto, context?: SecurityContext) {
    const email = this.normalizeEmail(dto.email);
    const requestedRole = dto.role;
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true } } },
    });
    const roleMatches = !requestedRole || user?.roles.some((item) => item.role.name === requestedRole);
    if (!user || !roleMatches) {
      await this.audit.log({
        action: 'PASSWORD_RESET_REQUESTED',
        entity: 'User',
        metadata: {
          emailHash: this.sha256(email),
          found: Boolean(user),
          requestedRole,
          roleMatched: Boolean(roleMatches),
        },
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });
      return { ok: true };
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = this.sha256(token);
    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 1000 * 60 * 30),
      },
    });
    const resetUrl = `${this.appUrl()}/reset-password?token=${token}`;
    await this.mail.sendTemplate(user.email, 'password-reset', {
      name: `${user.firstName} ${user.lastName}`,
      resetUrl,
    });
    await this.audit.log({
      actorId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      entity: 'User',
      entityId: user.id,
      metadata: { found: true, requestedRole, roleMatched: true },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });
    return { ok: true };
  }

  async resetPassword(dto: ResetPasswordDto, context?: SecurityContext) {
    const tokenHash = this.sha256(dto.token);
    const reset = await this.prisma.passwordReset.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!reset) {
      throw new NotFoundException('Reset token is invalid or expired');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: reset.userId },
        data: {
          passwordHash: await this.hashSecret(dto.password),
          refreshTokenHash: null,
        },
      }),
      this.prisma.passwordReset.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      }),
    ]);
    await this.audit.log({
      actorId: reset.userId,
      action: 'PASSWORD_CHANGED',
      entity: 'User',
      entityId: reset.userId,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });
    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: this.userInclude,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.serializeUser(user);
  }

  private async issueTokens(user: any) {
    const roles = user.roles.map((item) => item.role.name);
    const payload = { sub: user.id, email: user.email, roles, sessionIssuedAt: Date.now() };
    const accessExpiresIn = this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m';
    const refreshExpiresIn = this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessExpiresIn as any,
      }),
      this.jwt.signAsync({ sub: user.id, tokenType: 'refresh' }, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiresIn as any,
      }),
    ]);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: await this.hashSecret(refreshToken) },
    });

    return {
      accessToken,
      refreshToken,
      user: this.serializeUser(user),
    };
  }

  private serializeUser(user: any) {
    const studentProfile = this.serializeStudentProfile(user.studentProfile);
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      status: user.status,
      roles: user.roles.map((item) => item.role.name),
      studentProfile,
      administratorProfile: user.administratorProfile,
      createdAt: user.createdAt,
    };
  }

  private serializeStudentProfile(profile: any) {
    if (!profile) return profile;
    const { profileImageStorageKey, ...safeProfile } = profile;
    void profileImageStorageKey;
    return {
      ...safeProfile,
      hasProfileImage: Boolean(profile.profileImageUploadedAt),
    };
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private studentRegistrationIdentifiers(dto: RegisterStudentDto, email: string, studentNumber?: string) {
    return [
      { type: RegistrationBlockIdentifierType.EMAIL, value: this.normalizeIdentifier(RegistrationBlockIdentifierType.EMAIL, email) },
      { type: RegistrationBlockIdentifierType.ID_NUMBER, value: this.normalizeIdentifier(RegistrationBlockIdentifierType.ID_NUMBER, dto.idNumber) },
      {
        type: RegistrationBlockIdentifierType.STUDENT_NUMBER,
        value: this.normalizeIdentifier(RegistrationBlockIdentifierType.STUDENT_NUMBER, studentNumber),
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

  private cleanOptionalString(value?: string) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private appUrl() {
    return this.config.get<string>('PUBLIC_APP_URL') ?? 'http://localhost:3000';
  }

  private toStaffRole(role: StaffRegistrationRoleName): (typeof STAFF_REGISTRATION_ROLES)[number] {
    const staffRole = role as RoleName;
    if (!STAFF_REGISTRATION_ROLES.includes(staffRole as (typeof STAFF_REGISTRATION_ROLES)[number])) {
      throw new BadRequestException('Unsupported staff role');
    }
    return staffRole as (typeof STAFF_REGISTRATION_ROLES)[number];
  }

  private registrationKeyMatches(provided: string, configured?: string) {
    const expected = configured?.trim();
    if (!expected) return false;
    const providedHash = createHash('sha256').update(provided).digest();
    const expectedHash = createHash('sha256').update(expected).digest();
    return timingSafeEqual(providedHash, expectedHash);
  }

  private isUniqueConstraint(error: unknown, field: string) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
    const target = (error.meta as { target?: unknown } | undefined)?.target;
    return Array.isArray(target) && target.includes(field);
  }

  private async hashSecret(value: string) {
    return bcrypt.hash(value, this.config.get<number>('BCRYPT_ROUNDS') ?? 12);
  }

  private sha256(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private readonly userInclude = {
    roles: { include: { role: true } },
    studentProfile: true,
    administratorProfile: true,
  } as const;

  private readonly staffRoleConfig: Record<
    (typeof STAFF_REGISTRATION_ROLES)[number],
    { envKey: string; description: string; mailLabel: string }
  > = {
    [RoleName.MANAGER]: {
      envKey: 'STAFF_MANAGER_REGISTRATION_KEY',
      description: 'Residence manager',
      mailLabel: 'manager',
    },
    [RoleName.SECURITY]: {
      envKey: 'STAFF_SECURITY_REGISTRATION_KEY',
      description: 'Security staff',
      mailLabel: 'security',
    },
    [RoleName.TECHNICIAN]: {
      envKey: 'STAFF_TECHNICIAN_REGISTRATION_KEY',
      description: 'Maintenance technician',
      mailLabel: 'technician',
    },
  };
}
