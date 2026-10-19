import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ResidenceRoomStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
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

  async update(actorId: string, id: string, dto: UpdateResidenceRoomDto) {
    const current = await this.prisma.residenceRoom.findUnique({
      where: { id },
      include: { residence: true },
    });
    if (!current) throw new NotFoundException('Residence room not found');
    if (current.status === dto.status) return current;

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
      }
      if (current.status !== ResidenceRoomStatus.AVAILABLE && dto.status === ResidenceRoomStatus.AVAILABLE) {
        await tx.residence.updateMany({
          where: { id: current.residenceId, availableRooms: { lt: current.residence.totalRooms } },
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
