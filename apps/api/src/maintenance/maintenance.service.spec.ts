import { MaintenancePriority, MaintenanceStatus } from '@prisma/client';

jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

import { MaintenanceService } from './maintenance.service';

describe('MaintenanceService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-28T08:20:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts the resolution SLA when an open request is acknowledged', async () => {
    const request = {
      id: 'request-id',
      referenceCode: 'MNT-TEST',
      userId: 'student-id',
      user: {
        id: 'student-id',
        email: 'student@example.com',
        firstName: 'Student',
        lastName: 'One',
        phone: null,
        studentProfile: null,
      },
      roomType: null,
      resolvedBy: null,
      acknowledgedBy: null,
      assignedTechnician: null,
      status: MaintenanceStatus.OPEN,
      priority: MaintenancePriority.HIGH,
      createdAt: new Date('2026-07-28T08:10:00.000Z'),
      acknowledgementDeadlineAt: new Date('2026-07-28T08:15:00.000Z'),
      acknowledgedAt: null,
      acknowledgedById: null,
      assignedTechnicianId: null,
      resolutionDeadlineAt: null,
      resolutionNote: null,
      resolvedAt: null,
      resolvedById: null,
      slaAcknowledgementBreachedAt: null,
      slaResolutionBreachedAt: null,
      slaStatus: 'ACK_BREACHED',
      title: 'Electric plugs',
    };
    const prisma = {
      maintenanceRequest: {
        findUnique: jest.fn().mockResolvedValue(request),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...request, ...data })),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          firstName: 'Tech',
          lastName: 'User',
          email: 'tech@example.com',
        }),
      },
    };
    const notifications = {
      maintenanceStatusChanged: jest.fn().mockResolvedValue(undefined),
    };
    const audit = {
      log: jest.fn().mockResolvedValue(undefined),
    };
    const config = {
      get: jest.fn((key: string) => (key === 'MAINTENANCE_HIGH_RESOLUTION_SLA_HOURS' ? 0.05 : undefined)),
    };
    const service = new MaintenanceService(prisma as never, notifications as never, audit as never, config as never);

    const result = await service.updateAdmin('technician-id', 'request-id', {
      status: MaintenanceStatus.ACKNOWLEDGED,
    });

    expect(result.acknowledgedAt).toEqual(new Date('2026-07-28T08:20:00.000Z'));
    expect(result.acknowledgedById).toBe('technician-id');
    expect(result.assignedTechnicianId).toBe('technician-id');
    expect(result.resolutionDeadlineAt).toEqual(new Date('2026-07-28T08:23:00.000Z'));
    expect(result.slaStatus).toBe('RESOLUTION_PENDING');
    expect(prisma.maintenanceRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: MaintenanceStatus.ACKNOWLEDGED,
          resolutionDeadlineAt: new Date('2026-07-28T08:23:00.000Z'),
        }),
      }),
    );
  });
});
