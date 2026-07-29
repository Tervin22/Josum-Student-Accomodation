import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { COMMUNICATION_MANAGEMENT_ROLES } from '../common/roles/role-groups';
import { CommunicationsService } from './communications.service';
import { CreateCommunicationDto } from './dto/create-communication.dto';
import { ListCommunicationsDto } from './dto/list-communications.dto';

@ApiTags('communications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...COMMUNICATION_MANAGEMENT_ROLES)
@Controller('communications')
export class CommunicationsController {
  constructor(private readonly communications: CommunicationsService) {}

  @Get()
  list(@Query() query: ListCommunicationsDto) {
    return this.communications.list(query);
  }

  @Post()
  send(@CurrentUser() user: { sub: string }, @Body() dto: CreateCommunicationDto) {
    return this.communications.send(user.sub, dto);
  }
}
