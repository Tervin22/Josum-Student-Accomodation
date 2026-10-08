import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ResidenceRoomStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateResidenceRoomsDto } from './dto/create-residence-rooms.dto';
import { ListResidenceRoomsDto } from './dto/list-residence-rooms.dto';
import { UpdateResidenceRoomDto } from './dto/update-residence-room.dto';

@Injectable()
export class ResidenceRoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(query: ListResidenceRoomsDto) {
    return this.prisma.residenceRoom.findMany({
      where: query.residenceId ? { residenceId: query.residenceId } : undefined,
      orderBy: [{ residenceId: 'asc' }, { roomNumber: 'asc' }],
      select: {
        id: true,
        residenceId: true,
        roomNumber: true,
        name: true,
        genderAllocation: true,
        roomTypeName: true,
        capacity: true,
        status: true,
      },
    });
  }

  async createMany(actorId: string, dto: CreateResidenceRoomsDto) {
    const roomTypeName = dto.roomTypeName.trim();
    const [residence, roomType] = await Promise.all([
      this.prisma.residence.findUnique({ where: { id: dto.residenceId } }),
      this.prisma.roomType.findUnique({ where: { roomTypeName } }),
    ]);
    if (!residence) throw new NotFoundException('Residence not found');
    if (!roomType) throw new NotFoundException('Room category not found');

    const capacity = dto.capacity ?? 1;
    const roomNamePrefix = dto.roomNamePrefix?.trim() || 'Room';
    const roomNumbers = Array.from({ length: dto.numberOfRooms }, (_, index) => dto.startRoomNumber + index);
    const endRoomNumber = roomNumbers[roomNumbers.length - 1];
    if (endRoomNumber > 10000) {
      throw new BadRequestException('Room number range cannot go above 10000');
    }

    const existingRooms = await this.prisma.residenceRoom.findMany({
      where: { residenceId: dto.residenceId, roomNumber: { in: roomNumbers } },
      select: { roomNumber: true },
      orderBy: { roomNumber: 'asc' },
    });
    if (existingRooms.length) {
      throw new ConflictException(
        `Room number${existingRooms.length === 1 ? '' : 's'} ${existingRooms.map((room) => room.roomNumber).join(', ')} already exist at ${residence.name}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.residenceRoom.createMany({
        data: roomNumbers.map((roomNumber) => ({
          residenceId: dto.residenceId,
          roomNumber,
          name: `${roomNamePrefix} ${roomNumber}`,
          genderAllocation: dto.genderAllocation,
          roomTypeName: roomType.roomTypeName,
          capacity,
          status: ResidenceRoomStatus.AVAILABLE,
        })),
      });
      await tx.residence.update({
        where: { id: dto.residenceId },
        data: {
          totalRooms: { increment: dto.numberOfRooms },
          availableRooms: { increment: dto.numberOfRooms },
        },
      });
      await tx.roomType.update({
        where: { id: roomType.id },
        data: {
          totalRooms: { increment: dto.numberOfRooms },
          availableRooms: { increment: dto.numberOfRooms },
        },
      });
    });

    await this.audit.log({
      actorId,
      action: 'CREATE_RESIDENCE_ROOMS',
      entity: 'Residence',
      entityId: dto.residenceId,
      metadata: {
        residenceName: residence.name,
        roomTypeName: roomType.roomTypeName,
        startRoomNumber: dto.startRoomNumber,
        endRoomNumber,
        numberOfRooms: dto.numberOfRooms,
        capacity,
        genderAllocation: dto.genderAllocation,
      },
    });

    return { created: dto.numberOfRooms };
  }

  async update(actorId: string, id: string, dto: UpdateResidenceRoomDto) {
    const current = await this.prisma.residenceRoom.findUnique({
      where: { id },
      include: { residence: true },
    });
    if (!current) throw new NotFoundException('Residence room not found');
    if (current.status === dto.status) return current;
    const roomType = await this.prisma.roomType.findUnique({
      where: { roomTypeName: current.roomTypeName },
      select: { totalRooms: true },
    });

    if (current.status === ResidenceRoomStatus.OCCUPIED && dto.status !== ResidenceRoomStatus.OCCUPIED) {
      const approvedApplication = await this.prisma.application.findFirst({
        where: { roomId: id, status: 'APPROVED' },
        select: { referenceCode: true },
      });
      if (approvedApplication) {
        throw new ConflictException(
          `Room is assigned to approved application ${approvedApplication.referenceCode}. Move or reverse that application first.`,
        );
      }
    }

    const room = await this.prisma.$transaction(async (tx) => {
      if (current.status === ResidenceRoomStatus.AVAILABLE && dto.status !== ResidenceRoomStatus.AVAILABLE) {
        const result = await tx.residence.updateMany({
          where: { id: current.residenceId, availableRooms: { gt: 0 } },
          data: { availableRooms: { decrement: 1 } },
        });
        if (!result.count) throw new ConflictException(`No available capacity remains at ${current.residence.name}`);
        await tx.roomType.updateMany({
          where: { roomTypeName: current.roomTypeName, availableRooms: { gt: 0 } },
          data: { availableRooms: { decrement: 1 } },
        });
      }
      if (current.status !== ResidenceRoomStatus.AVAILABLE && dto.status === ResidenceRoomStatus.AVAILABLE) {
        await tx.residence.updateMany({
          where: { id: current.residenceId, availableRooms: { lt: current.residence.totalRooms } },
          data: { availableRooms: { increment: 1 } },
        });
        await tx.roomType.updateMany({
          where: { roomTypeName: current.roomTypeName, availableRooms: { lt: roomType?.totalRooms ?? current.residence.totalRooms } },
          data: { availableRooms: { increment: 1 } },
        });
      }
      return tx.residenceRoom.update({ where: { id }, data: { status: dto.status }, include: { residence: true } });
    });

    await this.audit.log({
      actorId,
      action: 'UPDATE_RESIDENCE_ROOM_STATUS',
      entity: 'ResidenceRoom',
      entityId: id,
      metadata: {
        residenceName: current.residence.name,
        roomNumber: current.roomNumber,
        fromStatus: current.status,
        toStatus: dto.status,
      },
    });
    return room;
  }
}
