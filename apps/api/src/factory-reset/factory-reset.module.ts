import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { FactoryResetController } from './factory-reset.controller';
import { FactoryResetService } from './factory-reset.service';

@Module({
  imports: [StorageModule],
  controllers: [FactoryResetController],
  providers: [FactoryResetService],
})
export class FactoryResetModule {}
