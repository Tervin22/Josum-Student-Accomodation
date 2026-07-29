import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { SECURITY_OPERATION_ROLES } from '../common/roles/role-groups';
import { CheckoutVisitorDto } from './dto/checkout-visitor.dto';
import { CreateIncidentReportDto } from './dto/create-incident-report.dto';
import { CreateVisitorPreRegistrationDto } from './dto/create-visitor-pre-registration.dto';
import { CreateVisitorLogDto } from './dto/create-visitor-log.dto';
import { ListVisitorPreRegistrationsDto } from './dto/list-visitor-pre-registrations.dto';
import { ListSecurityRecordsDto } from './dto/list-security-records.dto';
import { UpdateIncidentReportDto } from './dto/update-incident-report.dto';
import { UpdateVisitorPreRegistrationStatusDto } from './dto/update-visitor-pre-registration-status.dto';
import { SecurityService } from './security.service';

@ApiTags('security')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...SECURITY_OPERATION_ROLES)
@Controller('security')
export class SecurityController {
  constructor(private readonly security: SecurityService) {}

  @Get('visitors')
  listVisitors(@Query() query: ListSecurityRecordsDto) {
    return this.security.listVisitors(query);
  }

  @Get('visitor-pre-registrations')
  listVisitorPreRegistrations(@Query() query: ListVisitorPreRegistrationsDto) {
    return this.security.listVisitorPreRegistrations(query);
  }

  @Get('visitor-pre-registrations/mine')
  @Roles(RoleName.STUDENT)
  listMyVisitorPreRegistrations(@CurrentUser() user: { sub: string }) {
    return this.security.listMyVisitorPreRegistrations(user.sub);
  }

  @Post('visitor-pre-registrations')
  @Roles(RoleName.STUDENT)
  createVisitorPreRegistration(@CurrentUser() user: { sub: string }, @Body() dto: CreateVisitorPreRegistrationDto) {
    return this.security.createVisitorPreRegistration(user.sub, dto);
  }

  @Patch('visitor-pre-registrations/:id/status')
  updateVisitorPreRegistrationStatus(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: UpdateVisitorPreRegistrationStatusDto,
  ) {
    return this.security.updateVisitorPreRegistrationStatus(user.sub, id, dto);
  }

  @Get('students/lookup')
  lookupStudent(@Query('studentNumber') studentNumber: string) {
    return this.security.lookupStudent(studentNumber);
  }

  @Post('visitors')
  createVisitor(@CurrentUser() user: { sub: string; roles: string[] }, @Body() dto: CreateVisitorLogDto) {
    return this.security.createVisitor(user, dto);
  }

  @Patch('visitors/:id/checkout')
  checkoutVisitor(@CurrentUser() user: { sub: string }, @Param('id') id: string, @Body() dto: CheckoutVisitorDto) {
    return this.security.checkoutVisitor(user.sub, id, dto);
  }

  @Get('incidents')
  listIncidents(@Query() query: ListSecurityRecordsDto) {
    return this.security.listIncidents(query);
  }

  @Post('incidents')
  createIncident(@CurrentUser() user: { sub: string }, @Body() dto: CreateIncidentReportDto) {
    return this.security.createIncident(user.sub, dto);
  }

  @Patch('incidents/:id')
  updateIncident(@CurrentUser() user: { sub: string }, @Param('id') id: string, @Body() dto: UpdateIncidentReportDto) {
    return this.security.updateIncident(user.sub, id, dto);
  }
}
