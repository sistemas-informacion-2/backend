import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { REQUIERE_PLAN } from '../../../common/decorators/plan.decorator.js';
import { CreateReportTemplateDto, ExportRequestDto, ReporteGenerativoRequestDto, UpdateReportTemplateDto } from '../dto/reporte-builder.dto.js';
import { ReportsController } from './reports.controller.js';

/** Funcion del plan que exige una ruta (lo que lee TenantGuard), o undefined si esta en todos los planes. */
function planDe(metodo: keyof ReportsController): unknown {
  return Reflect.getMetadata(REQUIERE_PLAN, ReportsController.prototype[metodo]);
}

describe('ReportsController: planes', () => {
  it('exportar una configuración cualquiera exige reportes avanzados (es el Constructor por otra puerta)', () => {
    expect(planDe('exportar')).toBe('reportesAvanzados');
    expect(planDe('ejecutar')).toBe('reportesAvanzados');
    expect(planDe('generativo')).toBe('reportesAvanzados');
    expect(planDe('resumen')).toBe('reportesAvanzados');
  });

  it('los predefinidos se ven, se ejecutan y se exportan en todos los planes', () => {
    expect(planDe('predefinidos')).toBeUndefined();
    expect(planDe('ejecutarPredefinido')).toBeUndefined();
    expect(planDe('exportarPredefinido')).toBeUndefined();
  });
});

describe('ReportsController: exportar con el contexto del generativo', () => {
  it('el contexto va al archivo y no a la consulta del reporte', async () => {
    const reportsService = { exportar: vi.fn().mockResolvedValue({ buffer: Buffer.from('x'), contentType: 'application/pdf', nombreArchivo: 'ventas.pdf' }) };
    const controller = new ReportsController(reportsService as never, {} as never);
    const res = { set: vi.fn(), send: vi.fn() };
    const contexto = { prompt: 'ventas de octubre', interpretacion: 'Ventas de octubre de 2026.' };

    await controller.exportar({ format: 'pdf' }, { reportType: 'VENTAS', selectedFields: ['producto'], contexto }, res as never);

    expect(reportsService.exportar).toHaveBeenCalledWith('pdf', { reportType: 'VENTAS', selectedFields: ['producto'] }, contexto);
    expect(res.send).toHaveBeenCalled();
  });

  it('valida el contexto: pedido y explicación obligatorios y con tope de largo', async () => {
    const base = { reportType: 'VENTAS', selectedFields: ['producto'] };
    const errores = async (datos: object) => (await validate(plainToInstance(ExportRequestDto, datos))).map((error) => error.property);

    expect(await errores({ ...base })).toEqual([]);
    expect(await errores({ ...base, contexto: { prompt: 'ventas', interpretacion: 'Ventas.' } })).toEqual([]);
    expect(await errores({ ...base, contexto: { prompt: '', interpretacion: 'Ventas.' } })).toEqual(['contexto']);
    expect(await errores({ ...base, contexto: { prompt: 'x'.repeat(1001), interpretacion: 'Ventas.' } })).toEqual(['contexto']);
  });
});

describe('DTOs de reportes: largos', () => {
  async function errores<T extends object>(clase: new () => T, datos: object): Promise<string[]> {
    return (await validate(plainToInstance(clase, datos))).map((error) => error.property);
  }

  it('el pedido al generativo no puede estar vacío ni pasar de 1000 caracteres', async () => {
    expect(await errores(ReporteGenerativoRequestDto, { prompt: 'ventas de hoy' })).toEqual([]);
    expect(await errores(ReporteGenerativoRequestDto, { prompt: '' })).toEqual(['prompt']);
    expect(await errores(ReporteGenerativoRequestDto, { prompt: 'x'.repeat(1001) })).toEqual(['prompt']);
  });

  it('el nombre de una plantilla no puede estar vacío ni pasar de 100 caracteres (antes daba error 500)', async () => {
    const config = { reportType: 'VENTAS', selectedFields: ['sucursal'] };
    expect(await errores(CreateReportTemplateDto, { nombre: 'Ventas del mes', config })).toEqual([]);
    expect(await errores(CreateReportTemplateDto, { nombre: '', config })).toEqual(['nombre']);
    expect(await errores(CreateReportTemplateDto, { nombre: 'x'.repeat(101), config })).toEqual(['nombre']);
    expect(await errores(UpdateReportTemplateDto, { nombre: 'x'.repeat(101) })).toEqual(['nombre']);
  });
});
