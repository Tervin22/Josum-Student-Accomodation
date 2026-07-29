import { ApplicationStatus, RegistrationBlockIdentifierType, RoleName, StayStatus, UserStatus } from '@prisma/client';
import { UsersService } from './users.service';

const activeStudent = {
  id: 'student-1',
  email: 'student@example.com',
  firstName: 'Student',
  lastName: 'One',
  status: UserStatus.ACTIVE,
  roles: [{ role: { name: RoleName.STUDENT } }],
  studentProfile: {
    idNumber: '0001015009087',
    studentNumber: 'STU-001',
  },
  administratorProfile: null,
  applications: [
    {
      id: 'application-1',
      referenceCode: 'JSA-1',
      userId: 'student-1',
      residenceId: 'residence-1',
      roomTypeId: 'room-type-1',
      roomId: 'room-1',
      status: ApplicationStatus.APPROVED,
      stayStatus: StayStatus.ACTIVE,
      acceptedAt: new Date('2026-07-10T08:00:00.000Z'),
      fundingType: 'Self Funding',
      studentIdNumber: '0001015009087',
      studentNumber: 'STU-001',
      residence: { id: 'residence-1', name: 'Josum 1', address: 'Address', totalRooms: 10 },
      roomType: { id: 'room-type-1', roomTypeName: 'Single Room', totalRooms: 10 },
      room: { id: 'room-1', name: 'Room 1', status: 'OCCUPIED' },
    },
  ],
};

function createService() {
  const tx = {
    application: { update: jest.fn().mockResolvedValue({}) },
    residenceRoom: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    residence: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    roomType: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    user: { update: jest.fn().mockResolvedValue({}) },
    studentRegistrationBlock: { upsert: jest.fn().mockResolvedValue({}) },
    notification: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    user: {
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn().mockResolvedValueOnce(activeStudent).mockResolvedValueOnce({
        ...activeStudent,
        status: UserStatus.SUSPENDED,
        applications: [
          {
            ...activeStudent.applications[0],
            status: ApplicationStatus.MOVED_OUT,
            stayStatus: StayStatus.TERMINATED,
            terminatedAt: new Date('2026-08-01T10:00:00.000Z'),
            terminationReason: 'Repeated non-payment',
          },
        ],
        sourceRegistrationBlocks: [
          {
            id: 'block-1',
            identifierType: RegistrationBlockIdentifierType.EMAIL,
            identifierNormalized: 'student@example.com',
            active: true,
            reason: 'Repeated non-payment',
            blockedAt: new Date('2026-08-01T10:00:00.000Z'),
            whitelistedAt: null,
          },
        ],
      }),
    },
    studentRegistrationBlock: {
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: jest.fn((callback) => callback(tx)),
  };
  const audit = { log: jest.fn().mockResolvedValue({}) };
  const storage = { save: jest.fn(), remove: jest.fn() };
  const config = { get: jest.fn() };
  const mail = { sendTemplate: jest.fn().mockResolvedValue({ status: 'SENT' }) };

  return {
    service: new UsersService(prisma as never, audit as never, storage as never, config as never, mail as never),
    prisma,
    tx,
    mail,
    audit,
  };
}

describe('UsersService stay termination', () => {
  it('filters blocked students and hides block details from non-admin student record viewers', async () => {
    const { service, prisma } = createService();
    prisma.user.findMany.mockResolvedValue([
      {
        ...activeStudent,
        applications: [],
        sourceRegistrationBlocks: [
          {
            id: 'block-1',
            identifierType: RegistrationBlockIdentifierType.EMAIL,
            identifierNormalized: 'student@example.com',
            active: true,
            reason: 'Repeated non-payment',
            blockedAt: new Date('2026-08-01T10:00:00.000Z'),
            whitelistedAt: null,
          },
        ],
      },
    ]);
    prisma.user.count.mockResolvedValue(1);

    const result = await service.listStudents({ page: 1, limit: 10 }, [RoleName.MANAGER]);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sourceRegistrationBlocks: { none: { active: true } },
        }),
      }),
    );
    expect(result.items[0].registrationBlocks).toEqual([]);
    expect(result.items[0].isRegistrationBlocked).toBe(false);
  });

  it('allows administrators to view blocked student details', async () => {
    const { service, prisma } = createService();
    prisma.user.findMany.mockResolvedValue([
      {
        ...activeStudent,
        applications: [],
        sourceRegistrationBlocks: [
          {
            id: 'block-1',
            identifierType: RegistrationBlockIdentifierType.EMAIL,
            identifierNormalized: 'student@example.com',
            active: true,
            reason: 'Repeated non-payment',
            blockedAt: new Date('2026-08-01T10:00:00.000Z'),
            whitelistedAt: null,
          },
        ],
      },
    ]);
    prisma.user.count.mockResolvedValue(1);

    const result = await service.listStudents({ page: 1, limit: 10 }, [RoleName.ADMINISTRATOR]);

    expect(prisma.user.findMany.mock.calls[0][0].where.sourceRegistrationBlocks).toBeUndefined();
    expect(result.items[0].registrationBlocks).toHaveLength(1);
    expect(result.items[0].isRegistrationBlocked).toBe(true);
  });

  it('does not allow a blocked student account to be reactivated without whitelisting', async () => {
    const { service, prisma } = createService();
    prisma.studentRegistrationBlock.count.mockResolvedValue(1);

    await expect(service.updateStudentStatus('admin-1', 'student-1', { status: UserStatus.ACTIVE })).rejects.toThrow(
      'Whitelist this student before reactivating the account',
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('terminates the active stay, blocks registration identifiers, revokes access, and emails the student', async () => {
    const { service, tx, mail, audit } = createService();

    const result = await service.terminateStudent('admin-1', 'student-1', { reason: 'Repeated non-payment' });

    expect(tx.application.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'application-1' },
        data: expect.objectContaining({
          status: ApplicationStatus.MOVED_OUT,
          stayStatus: StayStatus.TERMINATED,
          terminationReason: 'Repeated non-payment',
          terminatedById: 'admin-1',
        }),
      }),
    );
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'student-1' },
      data: { status: UserStatus.SUSPENDED, refreshTokenHash: null },
    });
    expect(tx.studentRegistrationBlock.upsert).toHaveBeenCalledTimes(3);
    expect(tx.residenceRoom.updateMany).toHaveBeenCalledWith({
      where: { id: 'room-1', status: 'OCCUPIED' },
      data: { status: 'AVAILABLE' },
    });
    expect(mail.sendTemplate).toHaveBeenCalledWith(
      'student@example.com',
      'student-stay-terminated',
      expect.objectContaining({
        terminationReason: 'Repeated non-payment',
        residenceName: 'Josum 1',
        roomName: 'Room 1',
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'TERMINATE_STUDENT_STAY' }));
    expect(result.isRegistrationBlocked).toBe(true);
  });
});
