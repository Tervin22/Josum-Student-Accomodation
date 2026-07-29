import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ResidencesService } from './residences.service';

@ApiTags('residences')
@Controller('residences')
export class ResidencesController {
  constructor(private readonly residences: ResidencesService) {}

  @Get()
  list() {
    return this.residences.list();
  }

  @Get(':id')
  getById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.residences.getById(id);
  }
}
