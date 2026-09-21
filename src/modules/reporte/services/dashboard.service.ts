import { Injectable } from '@nestjs/common';
import { DashboardRepository } from '../repositories/dashboard.repository.js';
import { DIAS_DASHBOARD_POR_DEFECTO, type DashboardQueryDto } from '../dto/dashboard-query.dto.js';
import type { DashboardResumenResponseDto } from '../dto/dashboard-resumen-response.dto.js';

@Injectable()
export class DashboardService {
  constructor(private readonly dashboardRepo: DashboardRepository) {}

  async resumen(query: DashboardQueryDto): Promise<DashboardResumenResponseDto> {
    const idSucursal = query.idSucursal ?? null;
    const dias = query.dias ?? DIAS_DASHBOARD_POR_DEFECTO;
    const ventasDisponibles = await this.dashboardRepo.tablasVentasExisten();

    const [cajasAbiertas, totalStockCritico, itemsStockCritico] = await Promise.all([
      this.dashboardRepo.contarCajasAbiertas(idSucursal),
      this.dashboardRepo.contarStockCritico(idSucursal),
      this.dashboardRepo.listarStockCritico(idSucursal),
    ]);

    const [ventasDia, topVariantes, ventasPorSucursal, tendenciaVentas] = ventasDisponibles
      ? await Promise.all([
          this.dashboardRepo.ventasDelDia(idSucursal),
          this.dashboardRepo.topVariantes(idSucursal, dias),
          this.dashboardRepo.ventasPorSucursal(dias),
          this.dashboardRepo.tendenciaVentas(idSucursal, dias),
        ])
      : [{ total: 0, cantidadNotas: 0 }, [], [], []];

    return {
      fecha: new Date().toISOString().slice(0, 10),
      idSucursal,
      dias,
      ventasDisponibles,
      ventasDia: {
        total: ventasDia.total,
        cantidadNotas: ventasDia.cantidadNotas,
        ticketPromedio: ventasDia.cantidadNotas > 0 ? Math.round((ventasDia.total / ventasDia.cantidadNotas) * 100) / 100 : 0,
      },
      cajasAbiertas,
      stockCritico: { total: totalStockCritico, items: itemsStockCritico },
      topVariantes,
      ventasPorSucursal,
      tendenciaVentas,
    };
  }
}
