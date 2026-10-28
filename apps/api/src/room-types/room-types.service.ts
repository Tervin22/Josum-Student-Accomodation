import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';

@Injectable()
export class RoomTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async listRoomTypes(residenceId?: string, includeArchived = false) {
    const types = await this.prisma.roomType.findMany({
      where: { ...(residenceId ? { residenceId } : {}), ...(!includeArchived ? { residence: { active: true } } : {}) },
      orderBy: { roomTypeName: 'asc' },
    });
    return Promise.all(types.map(async type => {
      const where = { residenceId: type.residenceId ?? undefined, roomTypeName: type.displayName ?? type.roomTypeName };
      const [totalRooms, availableRooms] = await Promise.all([
        this.prisma.residenceRoom.count({ where }),
        this.prisma.residenceRoom.count({ where: { ...where, status: 'AVAILABLE' } }),
      ]);
      return { ...type, totalRooms, availableRooms };
    }));
  }

  async updateRoomType(actorId: string, id: string, dto: UpdateRoomTypeDto) {
    const current = await this.prisma.roomType.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException('Room type not found');
    }

    if (dto.totalRooms === undefined) {
      throw new BadRequestException('Total rooms is required');
    }

    this.assertRoomUpdatePasscode(dto.passcode);

    const where = { residenceId: current.residenceId ?? undefined, roomTypeName: current.displayName ?? current.roomTypeName };
    const totalRooms = await this.prisma.residenceRoom.count({ where });
    if (dto.totalRooms !== totalRooms) {
      throw new BadRequestException('Room totals are determined by the numbered room inventory');
    }
    const availableRooms = await this.prisma.residenceRoom.count({ where: { ...where, status: 'AVAILABLE' } });

    const roomType = await this.prisma.roomType.update({
      where: { id },
      data: {
        totalRooms,
        availableRooms,
      },
    });

    await this.audit.log({
      actorId,
      action: 'UPDATE_ROOM_TYPE',
      entity: 'RoomType',
      entityId: id,
      metadata: { totalRooms, availableRooms },
    });

    return roomType;
  }

  validateRoomUpdatePasscode(passcode: string) {
    this.assertRoomUpdatePasscode(passcode);
    return { ok: true };
  }

  private assertRoomUpdatePasscode(passcode: string) {
    const configuredKey = this.config.get<string>('ROOM_UPDATE_PASSCODE') ?? this.config.get<string>('FACTORY_RESET_RECOVERY_KEY');
    if (!configuredKey) {
      throw new ServiceUnavailableException('Room update passcode is not configured');
    }
    if (!this.timingSafeCompare(passcode.trim(), configuredKey.trim())) {
      throw new ForbiddenException('Invalid room update passcode');
    }
  }

  private timingSafeCompare(left: string, right: string) {
    const leftHash = createHash('sha256').update(left).digest();
    const rightHash = createHash('sha256').update(right).digest();
    return timingSafeEqual(leftHash, rightHash);
  }
}
