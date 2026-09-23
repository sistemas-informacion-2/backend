import { BadRequestException } from '@nestjs/common';
import { ReportBuilderService } from './report-builder.service.js';

function crearBuilder(respuestas: unknown[]) {
  const query = vi.fn();
  respuestas.forEach((respuesta) => query.mockResolvedValueOnce(respuesta));
  const dataSource = { query } as never;
  return { service: new ReportBuilderService(dataSource), query };
}

describe('ReportBuilderService', () => {
  it('el catálogo expone id/nombre y campos con name/label/operadores', async () => {
    const { service } = crearBuilder([]);

    const catalogo = service.catalogo();

    expect(catalogo.map((tipos) => tipos.id)).toEqual(['VENTAS', 'INVENTARIO', 'COMPRAS']);
    expect(catalogo[0].nombre).toBe('Ventas');
    const sucursal = catalogo[0].campos.find((campo) => campo.name === 'sucursal');
    expect(sucursal?.label).toBe('Sucursal');
    expect(sucursal?.operadores.length).toBeGreaterThan(0);
    expect(sucursal?.permiteFiltro).toBe(true);
    expect(sucursal?.permiteOrden).toBe(true);
    const stockCritico = catalogo[1].campos.find((campo) => campo.name === 'en_stock_critico');
    expect(stockCritico?.tipo).toBe('BOOLEAN');
    expect(stockCritico?.permiteOrden).toBe(false);
  });

  it('agrupa al haber medidas y resume con SUM', async () => {
    const { service, query } = crearBuilder([
      [{ total: 3 }],
      [{ fecha_emision: new Date('2026-09-01'), sucursal: 'La Paz', monto_total: 150.5, cantidad: 2 }],
    ]);

    const resultado = await service.ejecutar({
      reportType: 'VENTAS',
      selectedFields: ['fecha_emision', 'sucursal', 'monto_total', 'cantidad'],
      sort: { campo: 'monto_total', direccion: 'desc' },
      limit: 10,
      offset: 0,
    });

    expect(query).toHaveBeenCalledTimes(2);
    const sql = query.mock.calls[1][0] as string;
    expect(sql).toContain('SUM(nv.monto_total)::float8');
    expect(sql).toContain('GROUP BY nv.fecha_emision, sc.nombre');
    expect(sql).toContain('ORDER BY SUM(nv.monto_total) DESC');
    expect(sql).toContain('LIMIT $1 OFFSET $2');
    expect(resultado.columns).toEqual(['fecha_emision', 'sucursal', 'monto_total', 'cantidad']);
    expect(resultado.columnLabels).toEqual(['Fecha', 'Sucursal', 'Monto total', 'Cantidad']);
    expect(resultado.total).toBe(3);
    expect(resultado.rows[0]).toEqual(['2026-09-01', 'La Paz', 150.5, 2]);
  });

  it('sin medidas hace un SELECT plano sin GROUP BY', async () => {
    const { service, query } = crearBuilder([
      [{ total: 2 }],
      [{ fecha_emision: new Date('2026-09-02'), codigo_nota: 'NV-1', sucursal: 'Cochabamba' }],
    ]);

    const resultado = await service.ejecutar({
      reportType: 'VENTAS',
      selectedFields: ['fecha_emision', 'codigo_nota', 'sucursal'],
      limit: 25,
      offset: 0,
    });

    const sql = query.mock.calls[1][0] as string;
    expect(sql).not.toContain('SUM(');
    expect(sql).not.toContain('GROUP BY');
    expect(resultado.rows[0]).toEqual(['2026-09-02', 'NV-1', 'Cochabamba']);
  });

  it('los filtros van siempre como parámetros (sin inyección SQL)', async () => {
    const { service, query } = crearBuilder([
      [{ total: 5 }],
      [{ sucursal: 'X', monto_total: 300 }],
    ]);

    await service.ejecutar({
      reportType: 'VENTAS',
      selectedFields: ['sucursal', 'monto_total'],
      filters: [{ campo: 'monto_total', operador: 'gte', valor: 100 }],
      sort: { campo: 'monto_total', direccion: 'desc' },
      limit: 25,
      offset: 0,
    });

    const [sql, parametros] = query.mock.calls[1] as [string, unknown[]];
    expect(sql).toContain('nv.monto_total >= $1');
    expect(sql).toContain(`JOIN sucursal sc`);
    expect(parametros).toEqual([100, 25, 0]);
  });

  it('rechaza tipos de reporte no soportados', async () => {
    const { service } = crearBuilder([]);
    await expect(
      service.ejecutar({ reportType: 'NARNIA', selectedFields: ['sucursal'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza campos fuera del catálogo (whitelist)', async () => {
    const { service } = crearBuilder([]);
    await expect(
      service.ejecutar({ reportType: 'VENTAS', selectedFields: ['DROP_TABLE'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza operadores que no aplican al tipo de dato', async () => {
    const { service } = crearBuilder([]);
    await expect(
      service.ejecutar({
        reportType: 'VENTAS',
        selectedFields: ['sucursal'],
        filters: [{ campo: 'monto_total', operador: 'contains', valor: 'abc' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('al agregar métricas, ordenar por una columna no incluida lanza 400 (no 500)', async () => {
    const { service } = crearBuilder([]);

    await expect(
      service.ejecutar({
        reportType: 'VENTAS',
        selectedFields: ['sucursal', 'monto_total'],
        sort: { campo: 'codigo_nota', direccion: 'desc' },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('al agregar métricas, ordenar por una métrica o columna incluida es válido', async () => {
    const { service, query } = crearBuilder([
      [{ total: 2 }],
      [{ sucursal: 'Cochabamba', monto_total: 400 }],
    ]);

    const cantidad = await service.ejecutar({
      reportType: 'VENTAS',
      selectedFields: ['sucursal', 'monto_total'],
      sort: { campo: 'monto_total', direccion: 'desc' },
    });

    expect(query.mock.calls[1][0]).toContain('ORDER BY SUM(nv.monto_total) DESC');
    expect(cantidad.total).toBe(2);
  });

  it('INVENTARIO ignora el rango de fechas (campoFechas null)', async () => {
    const { service, query } = crearBuilder([
      [{ total: 1 }],
      [{ sucursal: 'La Paz', producto: 'Polo', stock_disponible: 3, en_stock_critico: true }],
    ]);

    await service.ejecutar({
      reportType: 'INVENTARIO',
      selectedFields: ['sucursal', 'producto', 'stock_disponible', 'en_stock_critico'],
      dateFrom: '2026-09-01',
    });

    const sql = query.mock.calls[1][0] as string;
    expect(sql).not.toContain('fecha_emision');
    expect(sql).not.toContain('>= $1');
  });
});