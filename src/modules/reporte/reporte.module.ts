import { Module } from '@nestjs/common';
import { DashboardController } from './controllers/dashboard.controller.js';
import { DashboardService } from './services/dashboard.service.js';
import { DashboardRepository } from './repositories/dashboard.repository.js';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, DashboardRepository],
})
export class ReporteModule {}
