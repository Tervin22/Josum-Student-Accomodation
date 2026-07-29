import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateInspectionDto } from './create-inspection.dto';

export class UpdateInspectionDto extends PartialType(
  OmitType(CreateInspectionDto, ['periodId', 'residenceId', 'roomId', 'studentId'] as const),
) {}
