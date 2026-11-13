import type { ReportBuilderService } from '../services/report-builder.service.js';
import type { ReportRunRequestDto } from '../dto/reporte-builder.dto.js';
import { ResumenReporteService } from './resumen-reporte.service.js';

/** Builder simulado: responde según las columnas pedidas, como lo haría la consulta real. */
function crearResumen(respuestas: Record<string, { rows: Array<Array<string | number | boolean>>; total?: number }>) {
  const ejecutar = vi.fn(async (request: ReportRunRequestDto) => {
    const clave = request.selectedFields.join(',');
    const respuesta = respuestas[clave] ?? { rows: [] };
    return { columns: request.selectedFields, columnLabels: [], columnFormats: [], rows: respuesta.rows, total: respuesta.total ?? respuesta.rows.length };
  });
  return { service: new ResumenReporteService({ ejecutar } as unknown as ReportBuilderService), ejecutar };
}

describe('ResumenReporteService', () => {
  it('VENTAS: indicadores, gráficos y análisis con los filtros del usuario, sobre todos los datos', async () => {
    const { service, ejecutar } = crearResumen({
      'monto_total,cantidad,notas': { rows: [[10000, 228, 40]] },
      'producto,monto_total,cantidad': {
        rows: [
          ['Polera', 5000, 100],
          ['Jean', 3000, 20],
          ['Gorra', 1000, 40],
          ['Medias', 600, 60],
          ['Bufanda', 400, 8],
        ],
        total: 5,
      },
      'sucursal,monto_total': { rows: [['Centro', 7000], ['Norte', 3000]] },
      'mes,monto_total': { rows: [['2026-10', 6000], ['2026-11', 4000]] },
    });

    const resumen = await service.resumir({
      reportType: 'VENTAS',
      selectedFields: ['producto', 'cantidad'],
      filters: [{ campo: 'sucursal', operador: 'eq', valor: 'Centro' }],
      dateFrom: '2026-10-01',
      dateTo: '2026-11-13',
      limit: 10,
      offset: 30,
    });

    // Cada consulta lleva los filtros y el rango del usuario, pero no su página ni su límite.
    for (const [request] of ejecutar.mock.calls) {
      expect(request.filters).toEqual([{ campo: 'sucursal', operador: 'eq', valor: 'Centro' }]);
      expect(request.dateFrom).toBe('2026-10-01');
      expect(request.offset).toBe(0);
    }
    expect(resumen.titulo).toBe('REPORTE DE VENTAS');
    expect(resumen.periodo).toEqual({ desde: '2026-10-01', hasta: '2026-11-13' });
    expect(resumen.sucursal).toBe('Centro');
    expect(resumen.indicadores.map((i) => [i.etiqueta, i.valor])).toEqual([
      ['Ingresos totales', 10000],
      ['Unidades vendidas', 228],
      ['Productos diferentes', 5],
      // El builder simulado responde la misma lista: el primero por unidades es Polera.
      ['Producto más vendido', 'Polera'],
      ['Producto con más ingresos', 'Polera'],
    ]);
    expect(resumen.indicadores[0].detalle).toBe('40 notas de venta');
    expect(resumen.graficos.map((g) => g.id)).toEqual(['ingresos-producto', 'participacion-producto', 'ranking-unidades', 'ingresos-sucursal', 'ingresos-mes']);
    // El anillo: 5 porciones y nada de "Otros", porque las 5 suman el total.
    expect(resumen.graficos[1].puntos.map((p) => p.etiqueta)).toEqual(['Polera', 'Jean', 'Gorra', 'Medias', 'Bufanda']);
    expect(resumen.graficos[2].puntos[0]).toEqual({ etiqueta: 'Polera', valor: 100 });
    expect(resumen.graficos[4].puntos[0].etiqueta).toBe('oct. 2026');
    expect(resumen.analisis.length).toBeGreaterThan(0);
  });

  it('el anillo agrupa el resto en "Otros"', async () => {
    const productos = Array.from({ length: 7 }, (_, i) => [`P${i + 1}`, 100, 1]);
    const { service } = crearResumen({
      'monto_total,cantidad,notas': { rows: [[700, 7, 7]] },
      'producto,monto_total,cantidad': { rows: productos, total: 7 },
    });

    const resumen = await service.resumir({ reportType: 'VENTAS', selectedFields: ['producto'] });

    const anillo = resumen.graficos.find((g) => g.tipo === 'ANILLO')!;
    expect(anillo.puntos.map((p) => p.etiqueta)).toEqual(['P1', 'P2', 'P3', 'P4', 'P5', 'Otros']);
    expect(anillo.puntos[5].valor).toBe(200);
  });

  it('INVENTARIO no tiene período y cuenta las variantes críticas', async () => {
    const { service } = crearResumen({
      'stock_disponible,variantes_criticas,valor_inventario': { rows: [[400, 3, 9000]] },
      'sucursal,stock_disponible': { rows: [['Centro', 300], ['Norte', 100]] },
      'sucursal,variantes_criticas': { rows: [['Centro', 3], ['Norte', 0]] },
    });

    const resumen = await service.resumir({ reportType: 'INVENTARIO', selectedFields: ['producto'] });

    expect(resumen.titulo).toBe('REPORTE DE INVENTARIO');
    expect(resumen.periodo).toBeNull();
    expect(resumen.indicadores[1]).toMatchObject({ etiqueta: 'Variantes en stock crítico', valor: 3 });
    // Solo las sucursales con alguna variante crítica entran al gráfico.
    expect(resumen.graficos.find((g) => g.id === 'criticas-sucursal')?.puntos).toEqual([{ etiqueta: 'Centro', valor: 3 }]);
  });

  it('COMPRAS calcula el promedio por orden y la cantidad de proveedores', async () => {
    const { service } = crearResumen({
      'total,ordenes': { rows: [[1000, 4]] },
      'proveedor,total': { rows: [['Textil Andina', 700], ['Moda Sur', 300]], total: 2 },
    });

    const resumen = await service.resumir({ reportType: 'COMPRAS', selectedFields: ['proveedor'] });

    expect(resumen.indicadores.map((i) => i.valor)).toEqual([1000, 4, 2, 'Textil Andina', 250]);
  });

  it('sin datos devuelve ceros, sin productos inventados', async () => {
    const { service } = crearResumen({ 'monto_total,cantidad,notas': { rows: [['', '', '']] } });

    const resumen = await service.resumir({ reportType: 'VENTAS', selectedFields: ['producto'] });

    expect(resumen.indicadores.map((i) => i.valor)).toEqual([0, 0, 0, null, null]);
    expect(resumen.graficos).toEqual([]);
    expect(resumen.analisis).toEqual(['No hay ventas en el período y con los filtros de este reporte.']);
  });

  it('con filtros combinados con OR no afirma una sola sucursal', async () => {
    const { service } = crearResumen({});

    const resumen = await service.resumir({
      reportType: 'VENTAS',
      selectedFields: ['producto'],
      matchType: 'OR',
      filters: [
        { campo: 'sucursal', operador: 'eq', valor: 'Centro' },
        { campo: 'sucursal', operador: 'eq', valor: 'Norte' },
      ],
    });

    expect(resumen.sucursal).toBeNull();
  });
});
