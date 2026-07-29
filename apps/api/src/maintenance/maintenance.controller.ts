import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { MAINTENANCE_WORKFLOW_ROLES } from '../common/roles/role-groups';
import { CreateMaintenanceRequestDto } from './dto/create-maintenance-request.dto';
import { ListMaintenanceRequestsDto } from './dto/list-maintenance-requests.dto';
import { UpdateMaintenanceRequestDto } from './dto/update-maintenance-request.dto';
import { MaintenanceService } from './maintenance.service';

@ApiTags('maintenance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Post()
  @Roles(RoleName.STUDENT)
  create(@CurrentUser() user: { sub: string }, @Body() dto: CreateMaintenanceRequestDto) {
    return this.maintenance.create(user.sub, dto);
  }

  @Get('mine')
  @Roles(RoleName.STUDENT)
  listMine(@CurrentUser() user: { sub: string }) {
    return this.maintenance.listMine(user.sub);
  }

  @Get('admin')
  @Roles(...MAINTENANCE_WORKFLOW_ROLES)
  listAdmin(@Query() query: ListMaintenanceRequestsDto) {
    return this.maintenance.listAdmin(query);
  }

  @Get('admin/:id')
  @Roles(...MAINTENANCE_WORKFLOW_ROLES)
  getAdmin(@Param('id') id: string) {
    return this.maintenance.getAdmin(id);
  }

  @Patch('admin/:id')
  @Roles(...MAINTENANCE_WORKFLOW_ROLES)
  updateAdmin(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: UpdateMaintenanceRequestDto,
  ) {
    return this.maintenance.updateAdmin(user.sub, id, dto);
  }
}
