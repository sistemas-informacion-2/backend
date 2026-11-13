import { BadRequestException } from '@nestjs/common';
import { ReportBuilderService } from './report-builder.service.js';

function crearBuilder(respuestas: unknown[]) {
  const query = vi.fn();
  respuestas.forEach((respuesta) => query.mockResolvedValueOnce(respuesta));
  const dataSource = { query } as never;
  return { service: new ReportBuilderService(dataSource, { empresaId: () => 7 } as never), query };
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
      // Como lo entrega pg para una columna date: medianoche local del proceso.
      [{ fecha_emision: new Date(2026, 8, 1), sucursal: 'La Paz', monto_total: 150.5, cantidad: 2 }],
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
    // La cantidad une el detalle: el monto de cada nota se reparte entre sus lineas en vez de repetirse.
    expect(sql).toContain('ROUND(SUM((nv.monto_total * COALESCE(dnv.peso, 1))), 2)::float8 AS "monto_total"');
    expect(sql).toContain('SUM(dnv.cantidad)::float8 AS "cantidad"');
    expect(sql).toContain('LEFT JOIN LATERAL (SELECT d.*,');
    expect(sql).toContain('GROUP BY nv.fecha_emision, sc.nombre');
    expect(sql).toContain('ORDER BY SUM((nv.monto_total * COALESCE(dnv.peso, 1))) DESC');
    expect(sql).toContain('WHERE nv.id_empresa = $1');
    expect(sql).toContain('LIMIT $2 OFFSET $3');
    expect(resultado.columns).toEqual(['fecha_emision', 'sucursal', 'monto_total', 'cantidad']);
    expect(resultado.columnLabels).toEqual(['Fecha', 'Sucursal', 'Monto total', 'Cantidad']);
    expect(resultado.total).toBe(3);
    expect(resultado.rows[0]).toEqual(['2026-09-01', 'La Paz', 150.5, 2]);
  });

  it('sin el detalle, las medidas de cabecera se suman tal cual', async () => {
    const { service, query } = crearBuilder([[{ total: 1 }], []]);
    await service.ejecutar({ reportType: 'VENTAS', selectedFields: ['sucursal', 'monto_total', 'descuento'] });
    const sql = query.mock.calls[1][0] as string;
    expect(sql).toContain('ROUND(SUM(nv.monto_total), 2)::float8 AS "monto_total"');
    expect(sql).toContain('ROUND(SUM(nv.descuento), 2)::float8 AS "descuento"');
    expect(sql).not.toContain('detalle_nota_venta');
    expect(sql).not.toContain('peso');
  });

  it('un filtro sobre el detalle tambien reparte, y el filtro sobre el monto sigue siendo el de la nota', async () => {
    const { service, query } = crearBuilder([[{ total: 1 }], []]);
    await service.ejecutar({
      reportType: 'VENTAS',
      selectedFields: ['sucursal', 'monto_total'],
      filters: [
        { campo: 'producto', operador: 'eq', valor: 'Camisa' },
        { campo: 'monto_total', operador: 'gte', valor: 100 },
      ],
    });
    const sql = query.mock.calls[1][0] as string;
    expect(sql).toContain('ROUND(SUM((nv.monto_total * COALESCE(dnv.peso, 1))), 2)::float8');
    expect(sql).toContain('LOWER(pr.nombre) = LOWER($1) AND nv.monto_total >= $2');
  });

  it('por nota y producto, cada producto recibe su parte del monto de la nota', async () => {
    const { service, query } = crearBuilder([[{ total: 1 }], []]);
    await service.ejecutar({ reportType: 'VENTAS', selectedFields: ['codigo_nota', 'producto', 'monto_total'] });
    const sql = query.mock.calls[1][0] as string;
    expect(sql).toContain('ROUND(SUM((nv.monto_total * COALESCE(dnv.peso, 1))), 2)::float8 AS "monto_total"');
    expect(sql).toContain('GROUP BY nv.codigo_nota, pr.nombre');
  });

  it('COMPRAS reparte el total entre lineas cuando se pide la cantidad', async () => {
    const { service, query } = crearBuilder([[{ total: 1 }], []]);
    await service.ejecutar({ reportType: 'COMPRAS', selectedFields: ['proveedor', 'total', 'cantidad'] });
    const sql = query.mock.calls[1][0] as string;
    expect(sql).toContain('ROUND(SUM((nc.total * COALESCE(dnc.peso, 1))), 2)::float8 AS "total"');
    expect(sql).toContain('FROM detalle_nota_compra d WHERE d.id_nota_compra = nc.id) dnc ON TRUE');
  });

  it('sin medidas hace un SELECT plano sin GROUP BY', async () => {
    const { service, query } = crearBuilder([
      [{ total: 2 }],
      [{ fecha_emision: new Date(2026, 8, 2), codigo_nota: 'NV-1', sucursal: 'Cochabamba' }],
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
    expect(parametros).toEqual([100, 7, 25, 0]);
  });

  it('siempre limita a la empresa actual, tambien el conteo y aunque los filtros se combinen con OR', async () => {
    const { service, query } = crearBuilder([[{ total: 0 }], []]);

    await service.ejecutar({
      reportType: 'COMPRAS',
      selectedFields: ['total'],
      filters: [
        { campo: 'total', operador: 'gte', valor: 1 },
        { campo: 'total', operador: 'lte', valor: 9 },
      ],
      matchType: 'OR',
    });

    for (const [sql, parametros] of query.mock.calls as Array<[string, unknown[]]>) {
      expect(sql).toContain('WHERE (nc.total >= $1 OR nc.total <= $2) AND nc.id_empresa = $3');
      expect(parametros[2]).toBe(7);
    }
  });

  it('INVENTARIO filtra la empresa por el almacen', async () => {
    const { service, query } = crearBuilder([[{ total: 0 }], []]);

    await service.ejecutar({ reportType: 'INVENTARIO', selectedFields: ['producto'] });

    expect(query.mock.calls[1][0]).toContain('JOIN almacen alm');
    expect(query.mock.calls[1][0]).toContain('WHERE alm.id_empresa = $1');
  });

  it('matchType "AND" (o ausente) combina los filtros con AND, sin paréntesis', async () => {
    const { service, query } = crearBuilder([[{ total: 1 }], [{ sucursal: 'X', monto_total: 300 }]]);

    await service.ejecutar({
      reportType: 'VENTAS',
      selectedFields: ['sucursal', 'monto_total'],
      filters: [
        { campo: 'monto_total', operador: 'gte', valor: 100 },
        { campo: 'sucursal', operador: 'eq', valor: 'La Paz' },
      ],
      limit: 25,
      offset: 0,
    });

    const sql = query.mock.calls[1][0] as string;
    expect(sql).toContain('WHERE nv.monto_total >= $1 AND LOWER(sc.nombre) = LOWER($2)');
  });

  it('matchType "OR" combina los filtros con OR, agrupados entre paréntesis', async () => {
    const { service, query } = crearBuilder([[{ total: 1 }], [{ sucursal: 'X', monto_total: 300 }]]);

    await service.ejecutar({
      reportType: 'VENTAS',
      selectedFields: ['sucursal', 'monto_total'],
      filters: [
        { campo: 'monto_total', operador: 'gte', valor: 100 },
        { campo: 'sucursal', operador: 'eq', valor: 'La Paz' },
      ],
      matchType: 'OR',
      limit: 25,
      offset: 0,
    });

    const sql = query.mock.calls[1][0] as string;
    expect(sql).toContain('WHERE (nv.monto_total >= $1 OR LOWER(sc.nombre) = LOWER($2))');
  });

  it('matchType "OR" no afecta el rango de fechas, que sigue siendo AND', async () => {
    const { service, query } = crearBuilder([[{ total: 1 }], [{ sucursal: 'X', monto_total: 300 }]]);

    await service.ejecutar({
      reportType: 'VENTAS',
      selectedFields: ['sucursal', 'monto_total'],
      filters: [
        { campo: 'monto_total', operador: 'gte', valor: 100 },
        { campo: 'sucursal', operador: 'eq', valor: 'La Paz' },
      ],
      matchType: 'OR',
      dateFrom: '2026-01-01',
      limit: 25,
      offset: 0,
    });

    const sql = query.mock.calls[1][0] as string;
    expect(sql).toContain('WHERE nv.fecha_emision >= $3 AND (nv.monto_total >= $1 OR LOWER(sc.nombre) = LOWER($2))');
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

  it('acepta un número escrito como texto en un filtro numérico (lo que manda un input type="number")', async () => {
    const { service, query } = crearBuilder([[{ total: 1 }], [{ sucursal: 'La Paz', monto_total: 150 }]]);

    await service.ejecutar({
      reportType: 'VENTAS',
      selectedFields: ['sucursal', 'monto_total'],
      filters: [
        { campo: 'monto_total', operador: 'gt', valor: '100' },
        { campo: 'monto_total', operador: 'lte', valor: ' 99,5 ' },
      ],
    });

    const params = query.mock.calls[1][1] as unknown[];
    expect(params.slice(0, 2)).toEqual([100, 99.5]);
  });

  it.each(['', 'abc', '1e9', '10.5.2'])('rechaza el texto "%s" en un filtro numérico con 400', async (valor) => {
    const { service } = crearBuilder([]);
    await expect(
      service.ejecutar({
        reportType: 'VENTAS',
        selectedFields: ['sucursal'],
        filters: [{ campo: 'monto_total', operador: 'gt', valor }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('en "contiene" el % y el _ del usuario son letras, no comodines', async () => {
    const { service, query } = crearBuilder([[{ total: 0 }], []]);

    await service.ejecutar({
      reportType: 'VENTAS',
      selectedFields: ['producto'],
      filters: [{ campo: 'producto', operador: 'contains', valor: '50%_off' }],
    });

    const [sql, params] = query.mock.calls[1] as [string, unknown[]];
    expect(sql).toContain("LOWER(pr.nombre) LIKE LOWER($1) ESCAPE '\\'");
    expect(params[0]).toBe('%50\\%\\_off%');
  });

  it('validar revisa la configuración sin consultar la base', () => {
    const { service, query } = crearBuilder([]);

    expect(() => service.validar({ reportType: 'VENTAS', selectedFields: ['sucursal', 'monto_total'] })).not.toThrow();
    // Con medidas, ordenar por una columna que no está en el reporte no es válido.
    expect(() =>
      service.validar({ reportType: 'VENTAS', selectedFields: ['sucursal', 'monto_total'], sort: { campo: 'fecha_emision', direccion: 'desc' } }),
    ).toThrow(BadRequestException);
    expect(query).not.toHaveBeenCalled();
  });

  it('COMPRAS compara y agrupa por el día de la compra, sin la hora', async () => {
    const { service, query } = crearBuilder([[{ total: 1 }], [{ fecha_emision: new Date(2025, 4, 19), total: 300 }]]);

    const resultado = await service.ejecutar({
      reportType: 'COMPRAS',
      selectedFields: ['fecha_emision', 'total'],
      filters: [{ campo: 'fecha_emision', operador: 'eq', valor: '2025-05-19' }],
      dateFrom: '2025-05-19',
      dateTo: '2025-05-19',
    });

    const sql = query.mock.calls[1][0] as string;
    // Con la columna timestamp tal cual, "hasta el 19/05" dejaba fuera las compras de ese día (>= 00:00).
    // Los filtros se numeran antes que el rango de fechas.
    expect(sql).toContain('nc.fecha_emision::date = $1');
    expect(sql).toContain('nc.fecha_emision::date >= $2');
    expect(sql).toContain('nc.fecha_emision::date <= $3');
    expect(sql).toContain('GROUP BY nc.fecha_emision::date');
    expect(resultado.rows[0][0]).toBe('2025-05-19');
  });

  it('INVENTARIO suma el stock y su valor por sucursal; el valor es a costo', async () => {
    const { service, query } = crearBuilder([[{ total: 2 }], [{ sucursal: 'La Paz', stock_disponible: 120, valor_inventario: 4500.5, valor_precio_venta: 9800 }]]);

    const resultado = await service.ejecutar({
      reportType: 'INVENTARIO',
      selectedFields: ['sucursal', 'stock_disponible', 'valor_inventario', 'valor_precio_venta'],
    });

    const sql = query.mock.calls[1][0] as string;
    expect(sql).toContain('SUM(inv.stock_disponible)::float8 AS "stock_disponible"');
    expect(sql).toContain('ROUND(SUM((inv.stock_disponible * vp.costo_promedio)), 2)::float8 AS "valor_inventario"');
    expect(sql).toContain('ROUND(SUM((inv.stock_disponible * pr.precio)), 2)::float8 AS "valor_precio_venta"');
    expect(sql).toContain('GROUP BY sc.nombre');
    expect(resultado.columnLabels).toEqual(['Sucursal', 'Stock disponible', 'Valor a costo', 'Valor a precio de venta']);
    expect(resultado.columnFormats).toEqual(['TEXTO', 'NUMERO', 'MONEDA', 'MONEDA']);
  });

  it('VENTAS calcula costo y margen por línea, como el BI (las líneas sin costo no suman)', async () => {
    const { service, query } = crearBuilder([[{ total: 1 }], [{ producto: 'Polo', costo: 40, margen: 60 }]]);

    await service.ejecutar({ reportType: 'VENTAS', selectedFields: ['producto', 'costo', 'margen'], sort: { campo: 'margen', direccion: 'desc' } });

    const sql = query.mock.calls[1][0] as string;
    expect(sql).toContain('ROUND(SUM((dnv.cantidad * dnv.costo_unitario)), 2)::float8 AS "costo"');
    expect(sql).toContain('CASE WHEN dnv.costo_unitario IS NULL THEN NULL ELSE nv.monto_total * COALESCE(dnv.peso, 1) - dnv.cantidad * dnv.costo_unitario END');
    // De mayor a menor margen, sin empezar por los productos sin costo.
    expect(sql).toContain('DESC NULLS LAST');
  });

  it('el catálogo marca los campos de dinero', () => {
    const { service } = crearBuilder([]);
    const ventas = service.catalogo().find((tipo) => tipo.id === 'VENTAS')!;

    expect(ventas.campos.find((campo) => campo.name === 'monto_total')?.moneda).toBe(true);
    expect(ventas.campos.find((campo) => campo.name === 'cantidad')?.moneda).toBe(false);
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