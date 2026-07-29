import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { FactoryResetDto } from './dto/factory-reset.dto';
import { FactoryResetService } from './factory-reset.service';

@ApiTags('factory-reset')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleName.ADMINISTRATOR)
@Controller('admin/factory-reset')
export class FactoryResetController {
  constructor(private readonly factoryReset: FactoryResetService) {}

  @Post()
  reset(@CurrentUser() user: { sub: string }, @Body() dto: FactoryResetDto) {
    return this.factoryReset.reset(user.sub, dto.recoveryKey);
  }
}
