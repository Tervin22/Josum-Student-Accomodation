import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { RegistrationBlockIdentifierType, UserStatus } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { SESSION_INVALIDATED_BEFORE_KEY } from '../../factory-reset/factory-reset.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: { sub: string; email: string; roles: string[]; sessionIssuedAt?: number; iat?: number }) {
    const invalidatedBefore = await this.getInvalidatedBefore();
    const issuedAt = payload.sessionIssuedAt ?? (payload.iat ? payload.iat * 1000 : 0);
    if (invalidatedBefore && issuedAt < invalidatedBefore) {
      throw new UnauthorizedException('Session expired after system reset');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { email: true, status: true, studentProfile: { select: { idNumber: true, studentNumber: true } } },
    });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }
    if (await this.hasActiveRegistrationBlock(user)) {
      throw new UnauthorizedException('Account has been terminated');
    }
    return payload;
  }

  private async hasActiveRegistrationBlock(user: {
    email: string;
    studentProfile?: { idNumber?: string | null; studentNumber?: string | null } | null;
  }) {
    const identifiers = [
      {
        identifierType: RegistrationBlockIdentifierType.EMAIL,
        identifierNormalized: user.email.trim().toLowerCase(),
      },
      {
        identifierType: RegistrationBlockIdentifierType.ID_NUMBER,
        identifierNormalized: user.studentProfile?.idNumber?.replace(/\D/g, ''),
      },
      {
        identifierType: RegistrationBlockIdentifierType.STUDENT_NUMBER,
        identifierNormalized: user.studentProfile?.studentNumber?.trim().toUpperCase(),
      },
    ].filter(
      (identifier): identifier is { identifierType: RegistrationBlockIdentifierType; identifierNormalized: string } =>
        Boolean(identifier.identifierNormalized),
    );

    return Boolean(
      await this.prisma.studentRegistrationBlock.findFirst({
        where: { active: true, OR: identifiers },
        select: { id: true },
      }),
    );
  }

  private async getInvalidatedBefore() {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: SESSION_INVALIDATED_BEFORE_KEY },
      select: { value: true },
    });
    const value = setting?.value;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) return parsed;
      const parsedDate = Date.parse(value);
      return Number.isNaN(parsedDate) ? 0 : parsedDate;
    }
    return 0;
  }
}
