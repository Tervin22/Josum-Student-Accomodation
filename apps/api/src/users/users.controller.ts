import { Body, Controller, Get, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { STUDENT_RECORD_ROLES, STUDENT_STATUS_ROLES } from '../common/roles/role-groups';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';
import { TerminateStudentDto } from './dto/terminate-student.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('students')
  @Roles(...STUDENT_RECORD_ROLES)
  listStudents(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationDto) {
    return this.users.listStudents(query, user.roles);
  }

  @Get('students/:id')
  @Roles(...STUDENT_RECORD_ROLES)
  getStudent(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.users.getStudent(id, user.roles);
  }

  @Patch('students/:id/status')
  @Roles(...STUDENT_STATUS_ROLES)
  updateStudentStatus(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.users.updateStudentStatus(user.sub, id, dto);
  }

  @Patch('students/:id/terminate')
  @Roles(RoleName.ADMINISTRATOR)
  terminateStudent(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: TerminateStudentDto,
  ) {
    return this.users.terminateStudent(user.sub, id, dto);
  }

  @Patch('students/:id/whitelist')
  @Roles(RoleName.ADMINISTRATOR)
  whitelistStudent(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.users.whitelistStudent(user.sub, id);
  }

  @Patch('me/profile')
  @Roles(RoleName.STUDENT)
  updateMyProfile(@CurrentUser() user: { sub: string }, @Body() dto: UpdateStudentProfileDto) {
    return this.users.updateMyProfile(user.sub, dto);
  }

  @Post('me/profile-photo')
  @Roles(RoleName.STUDENT)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  uploadMyProfilePhoto(@CurrentUser() user: { sub: string }, @UploadedFile() file?: Express.Multer.File) {
    return this.users.uploadMyProfilePhoto(user.sub, file);
  }
}
