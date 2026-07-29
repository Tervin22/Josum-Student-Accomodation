import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { APPLICATION_REVIEW_ROLES } from '../common/roles/role-groups';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ListApplicationsDto } from './dto/list-applications.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';

@ApiTags('applications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Get('admin/stats')
  @Roles(...APPLICATION_REVIEW_ROLES)
  stats() {
    return this.applications.stats();
  }

  @Get('admin')
  @Roles(...APPLICATION_REVIEW_ROLES)
  listAdmin(@Query() query: ListApplicationsDto) {
    return this.applications.listAdmin(query);
  }

  @Get('admin/:id')
  @Roles(...APPLICATION_REVIEW_ROLES)
  getAdmin(@Param('id') id: string) {
    return this.applications.getAdmin(id);
  }

  @Patch('admin/:id/status')
  @Roles(...APPLICATION_REVIEW_ROLES)
  changeStatus(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: UpdateApplicationStatusDto,
  ) {
    return this.applications.changeStatus(user.sub, id, dto);
  }

  @Post()
  @Roles(RoleName.STUDENT)
  create(@CurrentUser() user: { sub: string }, @Body() dto: CreateApplicationDto) {
    return this.applications.create(user.sub, dto);
  }

  @Get('mine')
  @Roles(RoleName.STUDENT)
  listMine(@CurrentUser() user: { sub: string }) {
    return this.applications.listMine(user.sub);
  }

  @Get('mine/:id')
  @Roles(RoleName.STUDENT)
  getMine(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.applications.getMine(user.sub, id);
  }

  @Patch('mine/:id/cancel')
  @Roles(RoleName.STUDENT)
  cancelMine(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.applications.cancelMine(user.sub, id);
  }

  @Patch('mine/:id/accept')
  @Roles(RoleName.STUDENT)
  acceptMine(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.applications.acceptMine(user.sub, id);
  }
}
