import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';
import { StorageRequestsController } from './storage-requests.controller';
import { StorageRequestsService } from './storage-requests.service';

@Module({
  imports: [AuditModule, NotificationsModule, StorageModule],
  controllers: [StorageRequestsController],
  providers: [StorageRequestsService],
})
export class StorageRequestsModule {}
