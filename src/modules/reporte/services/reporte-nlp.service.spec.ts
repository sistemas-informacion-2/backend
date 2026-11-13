import { ReporteNlpService } from './reporte-nlp.service.js';
import { fechaLocal, sumarDias } from '../../../common/utils/fecha.util.js';
import { fijarReloj } from '../../../common/utils/reloj.js';

function crearNlp(nombresSucursales: string[]) {
  const dataSource = {
    query: vi.fn().mockResolvedValue(nombresSucursales.map((nombre) => ({ nombre }))),
  } as never;
  return new ReporteNlpService(dataSource, { empresaId: () => 1 } as never);
}

describe('ReporteNlpService', () => {
  it('detecta el top de prendas más vendidas', async () => {
    const nlp = crearNlp([]);

    const { request, interpretacion } = await nlp.interpretar('Muéstrame las 5 prendas más vendidas');

    expect(request.reportType).toBe('VENTAS');
    expect(request.limit).toBe(5);
    expect(request.sort).toEqual({ campo: 'cantidad', direccion: 'desc' });
    expect(request.offset).toBe(0);
    expect(interpretacion).toContain('primeras');
    expect(interpretacion).toContain('Ventas');
  });

  it('detecta stock crítico y filtra por él', async () => {
    const nlp = crearNlp([]);

    const { request } = await nlp.interpretar('Inventario en stock crítico');

    expect(request.reportType).toBe('INVENTARIO');
    expect(request.filters).toEqual([{ campo: 'en_stock_critico', operador: 'eq', valor: true }]);
  });

  it('el orden por defecto de inventario usa un campo que existe ahí (no fecha_emision)', async () => {
    // Bug real: el orden por defecto estaba fijo en fecha_emision sin
    // importar el tipo, y ese campo no existe en el reporte de Inventario
    // (es una foto del stock, no un movimiento con fecha) — cualquier pedido
    // de inventario que no fuera "top N" tiraba
    // `El campo "fecha_emision" no existe en el reporte "Inventario y Stock"`.
    const nlp = crearNlp([]);

    const { request } = await nlp.interpretar('Stock crítico de las últimas dos semanas');

    expect(request.reportType).toBe('INVENTARIO');
    expect(request.sort).toEqual({ campo: 'stock_disponible', direccion: 'asc' });
    expect(request.selectedFields).not.toContain('fecha_emision');
  });

  it('"dos semanas" cubre 14 días, no 7', async () => {
    const nlp = crearNlp([]);

    const { request, interpretacion } = await nlp.interpretar('Ventas de las últimas dos semanas');

    expect(request.dateFrom).toBe(sumarDias(fechaLocal(), -13));
    expect(interpretacion).toContain('2 semanas');
  });

  it('asocia el pedido a una sucursal existente', async () => {
    const nlp = crearNlp(['La Paz Centro', 'Santa Cruz']);

    const { request } = await nlp.interpretar('ventas de la sucursal santa cruz la semana pasada');

    expect(request.reportType).toBe('VENTAS');
    expect(request.filters).toEqual([{ campo: 'sucursal', operador: 'eq', valor: 'Santa Cruz' }]);
    expect(request.dateFrom).toBeTruthy();
  });

  it('reconoce pedidos de compras', async () => {
    const nlp = crearNlp([]);

    const { request } = await nlp.interpretar('reporte de compras a proveedores');

    expect(request.reportType).toBe('COMPRAS');
    expect(request.filters).toEqual([]);
  });

  describe('períodos', () => {
    // Jueves 13/11/2026 a las 11:00 en La Paz.
    beforeEach(() => fijarReloj(new Date('2026-11-13T15:00:00Z')));
    afterEach(() => fijarReloj(null));

    it.each([
      ['ventas de ayer', '2026-11-12', '2026-11-12', 'ayer'],
      ['ventas del mes pasado', '2026-10-01', '2026-10-31', 'el mes pasado'],
      ['ventas del mes anterior', '2026-10-01', '2026-10-31', 'el mes pasado'],
      ['ventas de este mes', '2026-11-01', '2026-11-13', 'este mes'],
      ['ventas del último mes', '2026-10-13', '2026-11-13', 'el último mes'],
      ['ventas de este año', '2026-01-01', '2026-11-13', 'este año'],
    ])('"%s" va del %s al %s', async (pedido, desde, hasta, texto) => {
      const { request, interpretacion } = await crearNlp([]).interpretar(pedido);

      expect(request.dateFrom).toBe(desde);
      expect(request.dateTo).toBe(hasta);
      expect(interpretacion).toContain(texto);
    });

    it('"el mes pasado" en enero es diciembre del año anterior', async () => {
      fijarReloj(new Date('2027-01-05T15:00:00Z'));
      const { request } = await crearNlp([]).interpretar('compras del mes pasado');

      expect(request.dateFrom).toBe('2026-12-01');
      expect(request.dateTo).toBe('2026-12-31');
    });
  });

  it.each(['top 5 de ventas', 'los 5 productos más vendidos', 'los 5 más vendidos'])('"%s" pide 5 filas ordenadas por cantidad', async (pedido) => {
    const { request } = await crearNlp([]).interpretar(pedido);

    expect(request.limit).toBe(5);
    expect(request.sort).toEqual({ campo: 'cantidad', direccion: 'desc' });
  });

  it('un pedido sin pistas cae en el reporte por defecto de ventas', async () => {
    const nlp = crearNlp([]);

    const { request, interpretacion } = await nlp.interpretar('evento');

    expect(request.reportType).toBe('VENTAS');
    expect(interpretacion).toContain('no se reconocieron');
  });
});