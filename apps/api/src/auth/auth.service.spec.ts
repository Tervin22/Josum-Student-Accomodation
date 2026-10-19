import { RegistrationBlockIdentifierType, RoleName, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { RegisterStudentDto } from './dto/register-student.dto';

const registerStudentDto: RegisterStudentDto = {
  email: 'student@example.com',
  password: 'StrongPass123!',
  firstName: 'Student',
  lastName: 'One',
  phone: '0712345678',
  studentNumber: 'STU-001',
  institution: 'NWU',
  course: 'BCom',
  yearOfStudy: 2,
  dateOfBirth: '2000-01-01',
  idNumber: '0001015009087',
  address: '1 Test Street',
};

function createService() {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    studentProfile: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    studentRegistrationBlock: {
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    role: {
      upsert: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const jwt = {
    signAsync: jest.fn().mockResolvedValueOnce('access-token').mockResolvedValueOnce('refresh-token'),
    verifyAsync: jest.fn(),
  };
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'BCRYPT_ROUNDS') return 4;
      if (key === 'PUBLIC_APP_URL') return 'https://portal.example.com';
      if (key === 'JWT_ACCESS_EXPIRES_IN') return '15m';
      if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
      return 'test-secret';
    }),
  };
  const mail = {
    sendTemplate: jest.fn().mockResolvedValue({ status: 'SENT' }),
  };
  const audit = {
    log: jest.fn().mockResolvedValue({}),
  };

  return {
    service: new AuthService(prisma as never, jwt as never, config as never, mail as never, audit as never),
    prisma,
    jwt,
    mail,
    audit,
  };
}

describe('AuthService terminated student access', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('blocks re-registration when a terminated identifier is active', async () => {
    const { service, prisma } = createService();
    prisma.studentRegistrationBlock.findFirst.mockResolvedValue({
      id: 'block-1',
      identifierType: RegistrationBlockIdentifierType.ID_NUMBER,
    });

    await expect(service.registerStudent(registerStudentDto)).rejects.toMatchObject({
      message: expect.stringMatching(/terminated/i),
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('blocks login for a suspended student with an active termination block', async () => {
    const { service, prisma } = createService();
    const passwordHash = await bcrypt.hash('StrongPass123!', 4);
    prisma.user.findUnique.mockResolvedValue({
      id: 'student-1',
      email: 'student@example.com',
      passwordHash,
      status: UserStatus.SUSPENDED,
      roles: [{ role: { name: RoleName.STUDENT } }],
      studentProfile: { idNumber: '0001015009087', studentNumber: 'STU-001' },
    });
    prisma.studentRegistrationBlock.findFirst.mockResolvedValue({ id: 'block-1' });

    await expect(service.login({ email: 'student@example.com', password: 'StrongPass123!' })).rejects.toThrow(
      'terminated',
    );
  });

  it('allows a whitelisted terminated student to register again by reactivating the account', async () => {
    const { service, prisma, jwt, mail } = createService();
    const existingUser = {
      id: 'student-1',
      email: 'student@example.com',
      firstName: 'Old',
      lastName: 'Name',
      passwordHash: 'hash',
      status: UserStatus.SUSPENDED,
      roles: [{ role: { name: RoleName.STUDENT } }],
      studentProfile: { idNumber: '0001015009087', studentNumber: 'STU-001' },
      administratorProfile: null,
      createdAt: new Date(),
    };
    const reactivatedUser = {
      ...existingUser,
      firstName: 'Student',
      lastName: 'One',
      status: UserStatus.ACTIVE,
    };
    prisma.studentRegistrationBlock.findFirst.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(existingUser);
    prisma.studentRegistrationBlock.count.mockResolvedValue(1);
    prisma.studentProfile.findFirst.mockResolvedValue(null);
    prisma.user.update.mockResolvedValueOnce(reactivatedUser).mockResolvedValueOnce({});

    const result = await service.registerStudent(registerStudentDto);

    expect(prisma.user.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 'student-1' },
        data: expect.objectContaining({ status: UserStatus.ACTIVE, refreshTokenHash: null }),
      }),
    );
    expect(mail.sendTemplate).toHaveBeenCalledWith(
      'student@example.com',
      'account-created',
      expect.objectContaining({ role: 'student' }),
    );
    expect(jwt.signAsync).toHaveBeenCalledTimes(2);
    expect(result.accessToken).toBe('access-token');
  });
});
