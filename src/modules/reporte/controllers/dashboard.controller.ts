import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { DashboardService } from '../services/dashboard.service.js';
import { DashboardQueryDto } from '../dto/dashboard-query.dto.js';
import type { DashboardResumenResponseDto } from '../dto/dashboard-resumen-response.dto.js';

@ApiTags('Reporte')
@Controller('analitica/dashboard')
@RequirePermission('analitica:dashboard:leer')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('resumen')
  @ApiOperation({ summary: 'KPIs del dashboard: ventas del dia, cajas abiertas, stock critico, top variantes y tendencia' })
  resumen(@Query() query: DashboardQueryDto): Promise<DashboardResumenResponseDto> {
    return this.dashboardService.resumen(query);
  }
}
