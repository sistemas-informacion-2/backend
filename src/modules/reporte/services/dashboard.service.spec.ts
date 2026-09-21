import { DashboardService } from './dashboard.service.js';

function crearService(overrides: Record<string, ReturnType<typeof vi.fn>> = {}) {
  const dashboardRepo = {
    tablasVentasExisten: vi.fn().mockResolvedValue(true),
    ventasDelDia: vi.fn().mockResolvedValue({ total: 300, cantidadNotas: 4 }),
    contarCajasAbiertas: vi.fn().mockResolvedValue(2),
    contarStockCritico: vi.fn().mockResolvedValue(1),
    listarStockCritico: vi.fn().mockResolvedValue([{ idInventario: 1 }]),
    topVariantes: vi.fn().mockResolvedValue([{ idVariante: 7, cantidadVendida: 9 }]),
    ventasPorSucursal: vi.fn().mockResolvedValue([{ idSucursal: 1, total: 300 }]),
    tendenciaVentas: vi.fn().mockResolvedValue([{ fecha: '2026-09-21', total: 300 }]),
    ...overrides,
  };

  return { service: new DashboardService(dashboardRepo as never), dashboardRepo };
}

describe('DashboardService', () => {
  it('consolida los KPIs y calcula el ticket promedio', async () => {
    const { service } = crearService();

    const resumen = await service.resumen({});

    expect(resumen.ventasDisponibles).toBe(true);
    expect(resumen.ventasDia).toEqual({ total: 300, cantidadNotas: 4, ticketPromedio: 75 });
    expect(resumen.cajasAbiertas).toBe(2);
    expect(resumen.stockCritico.total).toBe(1);
    expect(resumen.topVariantes).toHaveLength(1);
    expect(resumen.tendenciaVentas).toHaveLength(1);
  });

  it('usa Vista General y 7 dias cuando no se filtra', async () => {
    const { service, dashboardRepo } = crearService();

    const resumen = await service.resumen({});

    expect(resumen.idSucursal).toBeNull();
    expect(resumen.dias).toBe(7);
    expect(dashboardRepo.contarCajasAbiertas).toHaveBeenCalledWith(null);
    expect(dashboardRepo.tendenciaVentas).toHaveBeenCalledWith(null, 7);
  });

  it('filtra por sucursal, pero el comparativo entre sucursales no se filtra', async () => {
    const { service, dashboardRepo } = crearService();

    await service.resumen({ idSucursal: 3, dias: 15 });

    expect(dashboardRepo.ventasDelDia).toHaveBeenCalledWith(3);
    expect(dashboardRepo.listarStockCritico).toHaveBeenCalledWith(3);
    expect(dashboardRepo.topVariantes).toHaveBeenCalledWith(3, 15);
    expect(dashboardRepo.ventasPorSucursal).toHaveBeenCalledWith(15);
  });

  it('devuelve ventas en cero sin consultar NOTA_VENTA si las tablas de CU13 no existen', async () => {
    const { service, dashboardRepo } = crearService({
      tablasVentasExisten: vi.fn().mockResolvedValue(false),
    });

    const resumen = await service.resumen({});

    expect(resumen.ventasDisponibles).toBe(false);
    expect(resumen.ventasDia).toEqual({ total: 0, cantidadNotas: 0, ticketPromedio: 0 });
    expect(resumen.topVariantes).toEqual([]);
    expect(resumen.tendenciaVentas).toEqual([]);
    expect(dashboardRepo.ventasDelDia).not.toHaveBeenCalled();
    expect(resumen.cajasAbiertas).toBe(2);
  });
});
