import { GeminiReporteService } from './gemini-reporte.service.js';
import { fechaLocal } from '../../../common/utils/fecha.util.js';
import { ReportBuilderService } from './report-builder.service.js';
import { ReporteNlpService } from './reporte-nlp.service.js';
import { ReportsService } from './reports.service.js';
import { ReportePlantillaRepository } from '../repositories/reporte-plantilla.repository.js';
import type { ReportePlantilla } from '../entities/reporte-plantilla.entity.js';
import type { TenantContext } from '../../../common/tenant/tenant-context.service.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { CuotaGenerativoService } from './cuota-generativo.service.js';

function crearService(overrides: { builder?: unknown; nlp?: unknown; gemini?: unknown; plantillaRepo?: unknown; cuota?: unknown } = {}) {
  const builder = {
    catalogo: vi.fn().mockReturnValue([]),
    ejecutar: vi.fn().mockResolvedValue({ columns: [], columnLabels: [], rows: [], total: 0 }),
    validar: vi.fn(),
    nombreTipo: vi.fn().mockReturnValue('Ventas'),
    ...(overrides.builder as Record<string, never> | undefined),
  } as unknown as ReportBuilderService;
  const nlp = {
    interpretar: vi.fn().mockResolvedValue({ request: { reportType: 'VENTAS' }, interpretacion: 'ok' }),
    ...(overrides.nlp as Record<string, never> | undefined),
  } as unknown as ReporteNlpService;
  // Por defecto, sin Gemini configurado: los tests existentes siguen probando el camino regex sin cambiar nada.
  const gemini = {
    disponible: false,
    interpretar: vi.fn(),
    ...(overrides.gemini as Record<string, never> | undefined),
  } as unknown as GeminiReporteService;
  const plantillaRepo = {
    listarPorUsuario: vi.fn().mockResolvedValue([]),
    buscarPropia: vi.fn(),
    crear: vi.fn(),
    actualizar: vi.fn(),
    eliminar: vi.fn(),
    ...(overrides.plantillaRepo as Record<string, never> | undefined),
  } as unknown as ReportePlantillaRepository;
  // Por defecto siempre hay cupo: los tests de Gemini no dependen del tope diario.
  const cuota = {
    consumir: vi.fn().mockReturnValue(true),
    ...(overrides.cuota as Record<string, never> | undefined),
  } as unknown as CuotaGenerativoService;
  const tenant = { empresaId: () => 7 } as unknown as TenantContext;

  return { service: new ReportsService(builder, nlp, gemini, plantillaRepo, cuota, tenant), builder, nlp, gemini, plantillaRepo, cuota };
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

  it('predefinidos expone solo metadatos, sin ejecutar nada', () => {
    const { service, builder } = crearService();

    const lista = service.predefinidos();

    expect(lista.length).toBeGreaterThan(0);
    expect(lista[0]).toEqual({ codigo: expect.any(String), nombre: expect.any(String), descripcion: expect.any(String), categoria: expect.any(String) });
    expect(builder.ejecutar).not.toHaveBeenCalled();
  });

  it('ejecutarPredefinido rechaza un codigo que no existe', async () => {
    const { service } = crearService();

    await expect(service.ejecutarPredefinido('NO_EXISTE')).rejects.toThrow('No existe el reporte predefinido');
  });

  it('ejecutarPredefinido de VENTAS_HOY resuelve dateFrom/dateTo al dia de hoy', async () => {
    const { service, builder } = crearService();
    const hoy = fechaLocal();

    const respuesta = await service.ejecutarPredefinido('VENTAS_HOY');

    expect(respuesta.codigo).toBe('VENTAS_HOY');
    expect(respuesta.request.reportType).toBe('VENTAS');
    expect(respuesta.request.dateFrom).toBe(hoy);
    expect(respuesta.request.dateTo).toBe(hoy);
    expect(builder.ejecutar).toHaveBeenCalledWith(respuesta.request);
  });

  it('ejecutarPredefinido de STOCK_CRITICO (INVENTARIO) nunca manda rango de fechas', async () => {
    const { service } = crearService();

    const respuesta = await service.ejecutarPredefinido('STOCK_CRITICO');

    expect(respuesta.request.reportType).toBe('INVENTARIO');
    expect(respuesta.request.dateFrom).toBeUndefined();
    expect(respuesta.request.dateTo).toBeUndefined();
    expect(respuesta.request.filters).toEqual([{ campo: 'en_stock_critico', operador: 'eq', valor: true }]);
  });

  it('generativo sin Gemini configurado cae directo al traductor por palabras clave', async () => {
    const { service, builder, nlp, gemini } = crearService({
      builder: {
        ejecutar: vi.fn().mockResolvedValue({ columns: ['sucursal'], columnLabels: ['Sucursal'], rows: [['La Paz', 10]], total: 1 }),
      },
    });

    const respuesta = await service.generativo('las 5 prendas más vendidas');

    expect(respuesta.prompt).toBe('las 5 prendas más vendidas');
    expect(respuesta.interpretacion).toBe('ok');
    expect(respuesta.request).toEqual({ reportType: 'VENTAS' });
    expect(respuesta.result.total).toBe(1);
    expect(respuesta.fuente).toBe('REGEX');
    expect(nlp.interpretar).toHaveBeenCalledWith('las 5 prendas más vendidas');
    expect(builder.ejecutar).toHaveBeenCalled();
    expect(gemini.interpretar).not.toHaveBeenCalled();
  });

  it('generativo usa Gemini cuando esta disponible', async () => {
    const { service, nlp, gemini } = crearService({
      gemini: {
        disponible: true,
        interpretar: vi.fn().mockResolvedValue({ request: { reportType: 'INVENTARIO', selectedFields: ['sucursal'] }, interpretacion: 'Inventario por sucursal, generado con IA.' }),
      },
    });

    const respuesta = await service.generativo('cuanto stock tengo por sucursal');

    expect(respuesta.fuente).toBe('IA');
    expect(respuesta.interpretacion).toBe('Inventario por sucursal, generado con IA.');
    expect(gemini.interpretar).toHaveBeenCalledWith('cuanto stock tengo por sucursal');
    expect(nlp.interpretar).not.toHaveBeenCalled();
  });

  it('generativo cae al traductor por palabras clave si Gemini falla', async () => {
    const { service, nlp } = crearService({
      gemini: { disponible: true, interpretar: vi.fn().mockRejectedValue(new Error('cuota agotada')) },
    });

    const respuesta = await service.generativo('ventas de hoy');

    expect(respuesta.fuente).toBe('REGEX');
    expect(nlp.interpretar).toHaveBeenCalledWith('ventas de hoy');
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

  it('generativo sin cupo diario no llama a Gemini, usa el traductor y lo avisa', async () => {
    const { service, nlp, gemini, cuota } = crearService({
      gemini: { disponible: true, interpretar: vi.fn() },
      cuota: { consumir: vi.fn().mockReturnValue(false) },
      nlp: { interpretar: vi.fn().mockResolvedValue({ request: { reportType: 'VENTAS', selectedFields: ['sucursal'] }, interpretacion: 'Reporte de Ventas' }) },
    });

    const respuesta = await service.generativo('ventas de hoy');

    expect(cuota.consumir).toHaveBeenCalledWith(7);
    expect(gemini.interpretar).not.toHaveBeenCalled();
    expect(nlp.interpretar).toHaveBeenCalledWith('ventas de hoy');
    expect(respuesta.fuente).toBe('REGEX');
    expect(respuesta.interpretacion).toContain('límite diario de reportes con IA');
  });

  it('generativo cae al traductor si la configuración de Gemini no es válida para el constructor (en vez de un 400)', async () => {
    const { service, builder, nlp } = crearService({
      gemini: { disponible: true, interpretar: vi.fn().mockResolvedValue({ request: { reportType: 'VENTAS', selectedFields: ['x'] }, interpretacion: 'ia' }) },
      builder: {
        validar: vi.fn().mockImplementation(() => {
          throw new BadRequestException('orden invalido');
        }),
      },
      nlp: { interpretar: vi.fn().mockResolvedValue({ request: { reportType: 'VENTAS', selectedFields: ['sucursal'] }, interpretacion: 'regex' }) },
    });

    const respuesta = await service.generativo('ventas por sucursal');

    expect(nlp.interpretar).toHaveBeenCalled();
    expect(respuesta.fuente).toBe('REGEX');
    expect(builder.ejecutar).toHaveBeenCalledWith({ reportType: 'VENTAS', selectedFields: ['sucursal'] });
  });

  it('generativo sin Gemini configurado no gasta cupo', async () => {
    const { service, cuota } = crearService();

    await service.generativo('ventas de hoy');

    expect(cuota.consumir).not.toHaveBeenCalled();
  });

  it('ejecutarPredefinido pide la página indicada (offset)', async () => {
    const { service, builder } = crearService();

    const respuesta = await service.ejecutarPredefinido('VENTAS_HOY', 50);

    expect(builder.ejecutar).toHaveBeenCalledWith(expect.objectContaining({ reportType: 'VENTAS', limit: 50, offset: 50 }));
    expect(respuesta.request.offset).toBe(50);
  });

  it('exportarPredefinido arma la configuración en el servidor y exporta todo', async () => {
    const { service, builder } = crearService({
      builder: { ejecutar: vi.fn().mockResolvedValue({ columns: ['sucursal'], columnLabels: ['Sucursal'], rows: [['La Paz']], total: 1 }) },
    });

    const archivo = await service.exportarPredefinido('pdf', 'STOCK_CRITICO');

    expect(builder.ejecutar).toHaveBeenCalledWith(
      expect.objectContaining({ reportType: 'INVENTARIO', filters: [{ campo: 'en_stock_critico', operador: 'eq', valor: true }], limit: 500, offset: 0 }),
    );
    // El archivo lleva el nombre del predefinido, no el del tipo de reporte.
    expect(archivo.nombreArchivo).toBe('stock-critico.pdf');
  });

  it('exportarPredefinido rechaza un código que no existe', async () => {
    const { service } = crearService();
    await expect(service.exportarPredefinido('html', 'NO_EXISTE')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('exportar descarga el reporte completo, no la página que se está viendo', async () => {
    const { service, builder } = crearService();

    await service.exportar('excel', { reportType: 'VENTAS', selectedFields: ['sucursal'], limit: 50, offset: 100 });

    expect(builder.ejecutar).toHaveBeenCalledWith({ reportType: 'VENTAS', selectedFields: ['sucursal'], limit: 500, offset: 0 });
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