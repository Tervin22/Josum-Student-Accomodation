import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ApplicationsModule } from './applications/applications.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CommunicationsModule } from './communications/communications.module';
import { validateEnvironment } from './configuration';
import { DocumentsModule } from './documents/documents.module';
import { FactoryResetModule } from './factory-reset/factory-reset.module';
import { HealthModule } from './health/health.module';
import { InspectionsModule } from './inspections/inspections.module';
import { MailModule } from './mail/mail.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentRemindersModule } from './payment-reminders/payment-reminders.module';
import { PrismaModule } from './prisma/prisma.module';
import { ResidencesModule } from './residences/residences.module';
import { ReportsModule } from './reports/reports.module';
import { ResidenceRoomsModule } from './residence-rooms/residence-rooms.module';
import { RoomTypesModule } from './room-types/room-types.module';
import { SettingsModule } from './settings/settings.module';
import { SecurityModule } from './security/security.module';
import { StorageRequestsModule } from './storage-requests/storage-requests.module';
import { StorageModule } from './storage/storage.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env.local', '../../.env', '.env.local', '.env'],
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL_MS ?? 60000),
        limit: Number(process.env.THROTTLE_LIMIT ?? 120),
      },
    ]),
    PrismaModule,
    AuditModule,
    MailModule,
    StorageModule,
    CommunicationsModule,
    NotificationsModule,
    PaymentRemindersModule,
    AuthModule,
    UsersModule,
    ResidencesModule,
    ReportsModule,
    InspectionsModule,
    ResidenceRoomsModule,
    RoomTypesModule,
    ApplicationsModule,
    MaintenanceModule,
    DocumentsModule,
    FactoryResetModule,
    SettingsModule,
    SecurityModule,
    StorageRequestsModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
