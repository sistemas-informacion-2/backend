import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BiModule } from '../bi/bi.module.js';
import { ReportePlantilla } from './entities/reporte-plantilla.entity.js';
import { ReportsController } from './controllers/reports.controller.js';
import { DashboardController } from './controllers/dashboard.controller.js';
import { DashboardService } from './services/dashboard.service.js';
import { DashboardRepository } from './repositories/dashboard.repository.js';
import { ReportBuilderService } from './services/report-builder.service.js';
import { GeminiReporteService } from './services/gemini-reporte.service.js';
import { ReporteNlpService } from './services/reporte-nlp.service.js';
import { ReportsService } from './services/reports.service.js';
import { CuotaGenerativoService } from './services/cuota-generativo.service.js';
import { ReportePlantillaRepository } from './repositories/reporte-plantilla.repository.js';

@Module({
  // BiModule aporta GeminiBiClient, el cliente de IA (Vertex o API key) que usa el generativo.
  imports: [TypeOrmModule.forFeature([ReportePlantilla]), BiModule],
  controllers: [ReportsController, DashboardController],
  providers: [
    DashboardService,
    DashboardRepository,
    ReportBuilderService,
    ReporteNlpService,
    GeminiReporteService,
    ReportsService,
    ReportePlantillaRepository,
    CuotaGenerativoService,
  ],
})
export class ReporteModule {}