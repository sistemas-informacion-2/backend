import { ReportBuilderService } from './report-builder.service.js';
import { ReporteNlpService } from './reporte-nlp.service.js';
import { ReportsService } from './reports.service.js';
import { ReportePlantillaRepository } from '../repositories/reporte-plantilla.repository.js';
import type { ReportePlantilla } from '../entities/reporte-plantilla.entity.js';

function crearService(overrides: { builder?: unknown; nlp?: unknown; plantillaRepo?: unknown } = {}) {
  const builder = {
    catalogo: vi.fn().mockReturnValue([]),
    ejecutar: vi.fn().mockResolvedValue({ columns: [], columnLabels: [], rows: [], total: 0 }),
    nombreTipo: vi.fn().mockReturnValue('Ventas'),
    ...(overrides.builder as Record<string, never> | undefined),
  } as unknown as ReportBuilderService;
  const nlp = {
    interpretar: vi.fn().mockResolvedValue({ request: { reportType: 'VENTAS' }, interpretacion: 'ok' }),
    ...(overrides.nlp as Record<string, never> | undefined),
  } as unknown as ReporteNlpService;
  const plantillaRepo = {
    listarPorUsuario: vi.fn().mockResolvedValue([]),
    buscarPropia: vi.fn(),
    crear: vi.fn(),
    actualizar: vi.fn(),
    eliminar: vi.fn(),
    ...(overrides.plantillaRepo as Record<string, never> | undefined),
  } as unknown as ReportePlantillaRepository;

  return { service: new ReportsService(builder, nlp, plantillaRepo), builder, nlp, plantillaRepo };
}

function plantilla(datos: Partial<ReportePlantilla>): ReportePlantilla {
  return {
    id: 1,
    idUsuario: 1,
    nombre: 'Ventas de la paz',
    config: { reportType: 'VENTAS', selectedFields: ['sucursal'] },
    fechaCreacion: new Date('2026-09-01T00:00:00Z'),
    fechaActualizacion: new Date('2026-09-01T00:00:00Z'),
    ...datos,
  } as ReportePlantilla;
}

describe('ReportsService', () => {
  it('delega el catálogo al builder', () => {
    const { service, builder } = crearService();

    service.catalogo();

    expect(builder.catalogo).toHaveBeenCalled();
  });

  it('generativo combina la interpretación con el resultado ejecutado', async () => {
    const { service, builder, nlp } = crearService({
      builder: {
        ejecutar: vi.fn().mockResolvedValue({ columns: ['sucursal'], columnLabels: ['Sucursal'], rows: [['La Paz', 10]], total: 1 }),
      },
    });

    const respuesta = await service.generativo('las 5 prendas más vendidas');

    expect(respuesta.prompt).toBe('las 5 prendas más vendidas');
    expect(respuesta.interpretacion).toBe('ok');
    expect(respuesta.request).toEqual({ reportType: 'VENTAS' });
    expect(respuesta.result.total).toBe(1);
    expect(nlp.interpretar).toHaveBeenCalledWith('las 5 prendas más vendidas');
    expect(builder.ejecutar).toHaveBeenCalled();
  });

  it('exportar genera un archivo con nombre desde el tipo', async () => {
    const { service } = crearService({
      builder: {
        ejecutar: vi.fn().mockResolvedValue({ columns: ['sucursal'], columnLabels: ['Sucursal'], rows: [['La Paz', 300]], total: 1 }),
      },
    });

    const archivo = await service.exportar('html', { reportType: 'VENTAS', selectedFields: ['sucursal'] });

    expect(archivo.contentType).toContain('text/html');
    expect(archivo.nombreArchivo).toBe('ventas.html');
  });

  it('crea una plantilla asignada al usuario actual', async () => {
    const { service, plantillaRepo } = crearService({
      plantillaRepo: { crear: vi.fn().mockResolvedValue(plantilla({})) },
    });

    const creada = await service.crearPlantilla(7, {
      nombre: 'Mi plantilla',
      config: { reportType: 'VENTAS', selectedFields: ['sucursal'] },
    });

    expect(plantillaRepo.crear).toHaveBeenCalledWith({
      idUsuario: 7,
      nombre: 'Mi plantilla',
      config: { reportType: 'VENTAS', selectedFields: ['sucursal'] },
    });
    expect(creada.idUsuario).toBe(1);
    expect(creada.nombre).toBe('Ventas de la paz');
  });

  it('actualizar y eliminar exigen que la plantilla sea del usuario', async () => {
    const { service, plantillaRepo } = crearService({
      plantillaRepo: {
        buscarPropia: vi.fn().mockResolvedValue(plantilla({ id: 9 })),
        actualizar: vi.fn().mockImplementation(async (p, cambios) => plantilla({ id: 9, ...cambios })),
        eliminar: vi.fn().mockResolvedValue(undefined),
      },
    });

    await service.actualizarPlantilla(3, 9, { nombre: 'Actualizada' });
    expect(plantillaRepo.buscarPropia).toHaveBeenCalledWith(9, 3);
    expect(plantillaRepo.actualizar).toHaveBeenCalled();

    await service.eliminarPlantilla(3, 9);
    expect(plantillaRepo.eliminar).toHaveBeenCalledWith(9);
  });
});