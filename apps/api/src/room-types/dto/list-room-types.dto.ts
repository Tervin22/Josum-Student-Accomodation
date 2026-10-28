import { IsOptional, IsUUID } from 'class-validator';
export class ListRoomTypesDto {
  @IsOptional() @IsUUID() residenceId?: string;
}
