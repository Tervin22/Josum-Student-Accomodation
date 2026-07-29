import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  check() {
    return this.readiness();
  }

  @Get('live')
  liveness() {
    return {
      status: 'ok',
      check: 'liveness',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  readiness() {
    return this.checkDatabase();
  }

  private async checkDatabase() {
    const startedAt = Date.now();
    try {
      await this.prisma.systemSetting.findFirst({ select: { id: true } });
      return {
        status: 'ok',
        check: 'readiness',
        database: 'connected',
        databaseLatencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Database readiness check failed', error instanceof Error ? error.stack : String(error));
      throw new ServiceUnavailableException('Database readiness check failed');
    }
  }
}
