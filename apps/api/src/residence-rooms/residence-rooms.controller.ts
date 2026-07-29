import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ROOM_MANAGEMENT_ROLES, ROOM_VIEW_ROLES } from '../common/roles/role-groups';
import { ListResidenceRoomsDto } from './dto/list-residence-rooms.dto';
import { UpdateResidenceRoomDto } from './dto/update-residence-room.dto';
import { ResidenceRoomsService } from './residence-rooms.service';

@ApiTags('residence-rooms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('residence-rooms')
export class ResidenceRoomsController {
  constructor(private readonly rooms: ResidenceRoomsService) {}

  @Get()
  @Roles(...ROOM_VIEW_ROLES)
  list(@Query() query: ListResidenceRoomsDto) {
    return this.rooms.list(query);
  }

  @Patch(':id')
  @Roles(...ROOM_MANAGEMENT_ROLES)
  update(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: UpdateResidenceRoomDto,
  ) {
    return this.rooms.update(user.sub, id, dto);
  }
}
