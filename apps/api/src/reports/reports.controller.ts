import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { APPLICATION_REVIEW_ROLES } from '../common/roles/role-groups';
import { FinanceReportQueryDto } from './dto/finance-report-query.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...APPLICATION_REVIEW_ROLES)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('finance')
  finance(@Query() query: FinanceReportQueryDto) {
    return this.reports.finance(query);
  }

  @Get('finance/export')
  async financeExport(
    @CurrentUser() user: { sub: string },
    @Query() query: FinanceReportQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const body = await this.reports.financeExport(user.sub, query);
    const filename = `josum-finance-report-${new Date().toISOString().slice(0, 10)}.csv`;
    response.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Content-Length': Buffer.byteLength(body),
      'X-Content-Type-Options': 'nosniff',
    });
    return body;
  }
}
