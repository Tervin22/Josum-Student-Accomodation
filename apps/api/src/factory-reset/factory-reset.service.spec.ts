import { RoleName } from '@prisma/client';
import { FactoryResetService } from './factory-reset.service';

function deleteManyResult(count = 0) {
  return jest.fn().mockResolvedValue({ count });
}

describe('FactoryResetService', () => {
  it('removes student and non-admin staff accounts during reset', async () => {
    const tx = {
      passwordReset: { deleteMany: deleteManyResult() },
      notification: { deleteMany: deleteManyResult() },
      communication: { deleteMany: deleteManyResult() },
      inspectionAttachment: { deleteMany: deleteManyResult() },
      inspection: { deleteMany: deleteManyResult() },
      inspectionPeriod: { deleteMany: deleteManyResult() },
      visitorLog: { deleteMany: deleteManyResult() },
      visitorPreRegistration: { deleteMany: deleteManyResult() },
      incidentReport: { deleteMany: deleteManyResult() },
      maintenanceRequest: { deleteMany: deleteManyResult() },
      storageRequestStatusHistory: { deleteMany: deleteManyResult() },
      storageRequestFile: { deleteMany: deleteManyResult() },
      storageRequest: { deleteMany: deleteManyResult() },
      paymentReminder: { deleteMany: deleteManyResult() },
      studentRegistrationBlock: { deleteMany: deleteManyResult() },
      applicationStatusHistory: { deleteMany: deleteManyResult() },
      document: { deleteMany: deleteManyResult() },
      application: { deleteMany: deleteManyResult() },
      emailLog: { deleteMany: deleteManyResult() },
      auditLog: { deleteMany: deleteManyResult() },
      user: {
        deleteMany: jest.fn().mockResolvedValueOnce({ count: 4 }).mockResolvedValueOnce({ count: 3 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      systemSetting: { upsert: jest.fn().mockResolvedValue({}) },
      roomType: {
        upsert: jest.fn().mockResolvedValue({}),
        deleteMany: deleteManyResult(),
        findMany: jest.fn().mockResolvedValue([{ id: 'room-type-1', totalRooms: 12 }]),
        update: jest.fn().mockResolvedValue({}),
      },
      residence: {
        findMany: jest.fn().mockResolvedValue([{ id: 'residence-1', totalRooms: 12 }]),
        update: jest.fn().mockResolvedValue({}),
      },
      residenceRoom: {
        updateMany: jest.fn().mockResolvedValue({ count: 12 }),
        count: jest.fn().mockResolvedValue(12),
      },
    };
    const prisma = {
      document: { findMany: jest.fn().mockResolvedValue([]) },
      storageRequestFile: { findMany: jest.fn().mockResolvedValue([]) },
      inspectionAttachment: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'admin-user-id' }) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new FactoryResetService(
      { get: jest.fn().mockReturnValue('recovery-key') } as never,
      prisma as never,
      { remove: jest.fn() } as never,
    );

    const result = await service.reset('admin-user-id', 'recovery-key');

    expect(tx.user.deleteMany).toHaveBeenNthCalledWith(1, {
      where: { roles: { some: { role: { name: RoleName.STUDENT } } } },
    });
    expect(tx.user.deleteMany).toHaveBeenNthCalledWith(2, {
      where: {
        roles: {
          some: { role: { name: { in: [RoleName.MANAGER, RoleName.SECURITY, RoleName.TECHNICIAN] } } },
          none: { role: { name: RoleName.ADMINISTRATOR } },
        },
      },
    });
    expect(result.deleted.students).toBe(4);
    expect(result.deleted.staffAccounts).toBe(3);
  });
});
