import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportePlantilla } from './entities/reporte-plantilla.entity.js';
import { ReportsController } from './controllers/reports.controller.js';
import { DashboardController } from './controllers/dashboard.controller.js';
import { DashboardService } from './services/dashboard.service.js';
import { DashboardRepository } from './repositories/dashboard.repository.js';
import { ReportBuilderService } from './services/report-builder.service.js';
import { ReporteNlpService } from './services/reporte-nlp.service.js';
import { ReportsService } from './services/reports.service.js';
import { ReportePlantillaRepository } from './repositories/reporte-plantilla.repository.js';

@Module({
  imports: [TypeOrmModule.forFeature([ReportePlantilla])],
  controllers: [ReportsController, DashboardController],
  providers: [
    DashboardService,
    DashboardRepository,
    ReportBuilderService,
    ReporteNlpService,
    ReportsService,
    ReportePlantillaRepository,
  ],
})
export class ReporteModule {}