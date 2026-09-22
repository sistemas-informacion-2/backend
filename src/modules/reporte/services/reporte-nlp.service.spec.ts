import { ReporteNlpService } from './reporte-nlp.service.js';

function crearNlp(nombresSucursales: string[]) {
  const dataSource = {
    query: vi.fn().mockResolvedValue(nombresSucursales.map((nombre) => ({ nombre }))),
  } as never;
  return new ReporteNlpService(dataSource);
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
    const hoy = new Date();
    const hace14Dias = new Date(hoy);
    hace14Dias.setDate(hace14Dias.getDate() - 13);
    const iso = (fecha: Date) => fecha.toISOString().slice(0, 10);

    const { request, interpretacion } = await nlp.interpretar('Ventas de las últimas dos semanas');

    expect(request.dateFrom).toBe(iso(hace14Dias));
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

  it('un pedido sin pistas cae en el reporte por defecto de ventas', async () => {
    const nlp = crearNlp([]);

    const { request, interpretacion } = await nlp.interpretar('evento');

    expect(request.reportType).toBe('VENTAS');
    expect(interpretacion).toContain('no se reconocieron');
  });
});