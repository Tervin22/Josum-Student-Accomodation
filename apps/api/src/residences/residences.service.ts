import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ResidencesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.residence.findMany({
      where: { name: { notIn: ['Josum 1', 'Josum 2'] } },
      orderBy: { name: 'asc' },
    });
  }

  async getById(id: string) {
    const residence = await this.prisma.residence.findUnique({ where: { id } });
    if (!residence) {
      throw new NotFoundException('Residence not found');
    }
    return residence;
  }
}
