import { ResidenceRoomsService } from './residence-rooms.service';

function setup() {
  const residence = { id: 'roma', active: true, allowedGenders: ['Female'], advertisedCapacity: 204, maleCapacity: 0, femaleCapacity: 204 };
  const room = { id: 'r1', residenceId: 'roma', roomNumber: 1, genderAllocation: 'Female', roomTypeName: 'Residence room', status: 'AVAILABLE', residence };
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    residence: { findUnique: jest.fn().mockResolvedValue(residence), update: jest.fn() },
    roomType: { findUnique: jest.fn().mockResolvedValue({ id: 'type', residenceId: 'roma', displayName: 'Residence room' }), update: jest.fn(), updateMany: jest.fn() },
    residenceRoom: { count: jest.fn().mockResolvedValue(0), findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(room), update: jest.fn().mockResolvedValue(room) },
    application: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const prisma = { $transaction: jest.fn(callback => callback(tx)), residenceRoom: { findUnique: jest.fn().mockResolvedValue(room) } };
  const service = new ResidenceRoomsService(prisma as never, { log: jest.fn() } as never);
  const dto = { residenceId: 'roma', roomTypeId: 'type', roomNumber: 1, genderAllocation: 'Female' as const };
  return { service, tx, dto, room };
}

describe('Confirmed residence room inventory', () => {
  it('creates only a supplied room number and increments only its residence and category', async () => {
    const { service, tx, dto } = setup();
    await service.create('admin', dto);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.residenceRoom.create).toHaveBeenCalledWith({ data: expect.objectContaining({ residenceId: 'roma', roomNumber: 1, capacity: 1 }) });
    expect(tx.residence.update).toHaveBeenCalledWith({ where: { id: 'roma' }, data: { totalRooms: { increment: 1 }, availableRooms: { increment: 1 } } });
    expect(tx.roomType.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'type' } }));
  });
  it('rejects categories belonging to another residence', async () => {
    const { service, tx, dto } = setup();
    tx.roomType.findUnique.mockResolvedValue({ id: 'type', residenceId: 'north', displayName: 'Residence room' });
    await expect(service.create('admin', dto)).rejects.toThrow('must belong');
    expect(tx.residenceRoom.create).not.toHaveBeenCalled();
  });
  it('rejects duplicate room numbers', async () => {
    const { service, tx, dto, room } = setup();
    tx.residenceRoom.findUnique.mockResolvedValue(room as never);
    await expect(service.create('admin', dto)).rejects.toThrow('already exists');
  });
  it('rejects male room allocation at a female-only residence', async () => {
    const { service, dto } = setup();
    await expect(service.create('admin', { ...dto, genderAllocation: 'Male' })).rejects.toThrow('not permitted');
  });
  it('enforces published gender and total limits', async () => {
    const { service, tx, dto } = setup();
    tx.residenceRoom.count.mockResolvedValue(204);
    await expect(service.create('admin', dto)).rejects.toThrow('capacity has been reached');
    expect(tx.residenceRoom.create).not.toHaveBeenCalled();
  });
  it('cannot change an assigned room outside its application workflow', async () => {
    const { service, tx, room } = setup();
    tx.residenceRoom.findUnique.mockResolvedValue({ ...room, status: 'OCCUPIED' } as never);
    tx.application.findFirst.mockResolvedValue({ referenceCode: 'RES-test' } as never);
    await expect(service.update('admin', 'r1', { status: 'AVAILABLE' })).rejects.toThrow('allocation workflow');
    expect(tx.residence.update).not.toHaveBeenCalled();
  });
  it('does not increment availability when a status is unchanged', async () => {
    const { service, tx, room } = setup();
    tx.residenceRoom.findUnique.mockResolvedValue(room as never);
    await service.update('admin', 'r1', { status: 'AVAILABLE' });
    expect(tx.residence.update).not.toHaveBeenCalled();
  });
});
