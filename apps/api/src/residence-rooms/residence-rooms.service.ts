import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ResidenceRoomStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateResidenceRoomDto } from './dto/create-residence-room.dto';
import { ListResidenceRoomsDto } from './dto/list-residence-rooms.dto';
import { UpdateResidenceRoomDto } from './dto/update-residence-room.dto';

@Injectable()
export class ResidenceRoomsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  list(query: ListResidenceRoomsDto) {
    return this.prisma.residenceRoom.findMany({
      where: query.residenceId ? { residenceId: query.residenceId } : undefined,
      orderBy: [{ residenceId: 'asc' }, { roomNumber: 'asc' }],
      select: { id: true, residenceId: true, roomNumber: true, name: true, genderAllocation: true,
        roomTypeName: true, capacity: true, status: true },
    });
  }

  async create(actorId: string, dto: CreateResidenceRoomDto) {
    const room = await this.prisma.$transaction(async tx => {
      await this.lockResidence(tx, dto.residenceId);
      const residence = await tx.residence.findUnique({ where: { id: dto.residenceId } });
      if (!residence?.active) throw new NotFoundException('Active residence not found');
      const type = await tx.roomType.findUnique({ where: { id: dto.roomTypeId } });
      if (!type || type.residenceId !== residence.id) throw new ConflictException('Room category must belong to this residence');
      if (!residence.allowedGenders.includes(dto.genderAllocation)) throw new ConflictException('Gender allocation is not permitted at this residence');
      const [count, genderCount, existing] = await Promise.all([
        tx.residenceRoom.count({ where: { residenceId: residence.id } }),
        tx.residenceRoom.count({ where: { residenceId: residence.id, genderAllocation: dto.genderAllocation } }),
        tx.residenceRoom.findUnique({ where: { residenceId_roomNumber: { residenceId: residence.id, roomNumber: dto.roomNumber } } }),
      ]);
      if (existing) throw new ConflictException('This room number already exists at the residence');
      const genderLimit = dto.genderAllocation === 'Male' ? residence.maleCapacity : residence.femaleCapacity;
      if ((residence.advertisedCapacity !== null && count >= residence.advertisedCapacity) ||
          (genderLimit !== null && genderCount >= genderLimit)) {
        throw new ConflictException('The published residence or gender capacity has been reached');
      }
      const created = await tx.residenceRoom.create({ data: {
        residenceId: residence.id, roomNumber: dto.roomNumber, name: dto.name?.trim() || `Room ${dto.roomNumber}`,
        genderAllocation: dto.genderAllocation, roomTypeName: type.displayName ?? type.roomTypeName, capacity: 1,
      } });
      await tx.residence.update({ where: { id: residence.id }, data: { totalRooms: { increment: 1 }, availableRooms: { increment: 1 } } });
      await tx.roomType.update({ where: { id: type.id }, data: { totalRooms: { increment: 1 }, availableRooms: { increment: 1 } } });
      return created;
    });
    await this.audit.log({ actorId, action: 'CREATE_RESIDENCE_ROOM', entity: 'ResidenceRoom', entityId: room.id,
      metadata: { residenceId: room.residenceId, roomNumber: room.roomNumber, genderAllocation: room.genderAllocation } });
    return room;
  }

  async update(actorId: string, id: string, dto: UpdateResidenceRoomDto) {
    const initial = await this.prisma.residenceRoom.findUnique({ where: { id } });
    if (!initial) throw new NotFoundException('Residence room not found');
    const result = await this.prisma.$transaction(async tx => {
      await this.lockResidence(tx, initial.residenceId);
      const current = await tx.residenceRoom.findUnique({ where: { id }, include: { residence: true } });
      if (!current) throw new NotFoundException('Residence room not found');
      if (current.status === dto.status) return { room: current, from: current.status };
      const assigned = await tx.application.findFirst({ where: { roomId: id, status: 'APPROVED' }, select: { referenceCode: true } });
      if (assigned) throw new ConflictException(`Room belongs to approved application ${assigned.referenceCode}. Use its allocation workflow.`);
      const delta = Number(dto.status === ResidenceRoomStatus.AVAILABLE) - Number(current.status === ResidenceRoomStatus.AVAILABLE);
      if (delta) {
        await tx.residence.update({ where: { id: current.residenceId }, data: { availableRooms: { increment: delta } } });
        await tx.roomType.updateMany({ where: { OR: [
          { residenceId: current.residenceId, displayName: current.roomTypeName },
          { residenceId: null, roomTypeName: current.roomTypeName },
        ] }, data: { availableRooms: { increment: delta } } });
      }
      return { room: await tx.residenceRoom.update({ where: { id }, data: { status: dto.status }, include: { residence: true } }), from: current.status };
    });
    await this.audit.log({ actorId, action: 'UPDATE_RESIDENCE_ROOM_STATUS', entity: 'ResidenceRoom', entityId: id,
      metadata: { residenceId: initial.residenceId, roomNumber: initial.roomNumber, fromStatus: result.from, toStatus: dto.status } });
    return result.room;
  }

  private lockResidence(tx: Prisma.TransactionClient, id: string) {
    return tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Residence" WHERE "id" = ${id}::uuid FOR UPDATE`);
  }
}
