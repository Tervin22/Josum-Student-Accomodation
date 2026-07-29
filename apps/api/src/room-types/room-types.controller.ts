import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ROOM_TYPE_MANAGEMENT_ROLES } from '../common/roles/role-groups';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';
import { ValidateRoomTypePasscodeDto } from './dto/validate-room-type-passcode.dto';
import { RoomTypesService } from './room-types.service';

@ApiTags('room-types')
@Controller('room-types')
export class RoomTypesController {
  constructor(private readonly roomTypes: RoomTypesService) {}

  @Get()
  listRoomTypes() {
    return this.roomTypes.listRoomTypes();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROOM_TYPE_MANAGEMENT_ROLES)
  @Get('admin')
  listAdminRoomTypes() {
    return this.roomTypes.listRoomTypes();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROOM_TYPE_MANAGEMENT_ROLES)
  @Patch(':id')
  updateRoomType(@CurrentUser() user: { sub: string }, @Param('id') id: string, @Body() dto: UpdateRoomTypeDto) {
    return this.roomTypes.updateRoomType(user.sub, id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROOM_TYPE_MANAGEMENT_ROLES)
  @Post(':id/unlock')
  validateRoomTypePasscode(@Body() dto: ValidateRoomTypePasscodeDto) {
    return this.roomTypes.validateRoomUpdatePasscode(dto.passcode);
  }
}
