import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ResidenceRoomsController } from './residence-rooms.controller';
import { ResidenceRoomsService } from './residence-rooms.service';

@Module({
  imports: [AuditModule],
  controllers: [ResidenceRoomsController],
  providers: [ResidenceRoomsService],
  exports: [ResidenceRoomsService],
})
export class ResidenceRoomsModule {}
