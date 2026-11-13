import { GeminiReporteService } from './gemini-reporte.service.js';
import type { GeminiBiClient } from '../../bi/agente/gemini.client.js';

function crearService(opciones: { modo?: 'VERTEX' | 'API_KEY' | 'SIN_CONFIGURAR'; model?: string } = {}, sucursales: string[] = ['La Paz', 'Santa Cruz']) {
  const config = { get: (clave: string) => (clave === 'gemini.model' ? (opciones.model ?? 'gemini-3.5-flash-lite') : undefined) };
  const dataSource = { query: vi.fn().mockResolvedValue(sucursales.map((nombre) => ({ nombre }))) };
  const generar = vi.fn();
  const ia = { modo: () => opciones.modo ?? 'VERTEX', generar } as unknown as GeminiBiClient;
  const tenant = { empresaId: () => 1, empresa: () => ({ id: 1, nombre: 'Moda Andina' }) };
  return { service: new GeminiReporteService(config as never, dataSource as never, tenant as never, ia), generar };
}

/** Respuesta del SDK de @google/genai: `text` es el JSON que armo el modelo. */
function respuesta(datos: object | string) {
  return { text: typeof datos === 'string' ? datos : JSON.stringify(datos), promptFeedback: undefined };
}

function errorHttp(status: number) {
  return Object.assign(new Error(`Gemini respondio ${status}`), { status });
}

describe('GeminiReporteService', () => {
  it('disponible es false sin Vertex ni API key', () => {
    const { service } = crearService({ modo: 'SIN_CONFIGURAR' });
    expect(service.disponible).toBe(false);
  });

  it('interpretar rechaza si no está configurado, sin llamar al modelo', async () => {
    const { service, generar } = crearService({ modo: 'SIN_CONFIGURAR' });
    await expect(service.interpretar('ventas de hoy')).rejects.toThrow();
    expect(generar).not.toHaveBeenCalled();
  });

  it('usa el modelo de los reportes y pide JSON con el esquema fijo', async () => {
    const { service, generar } = crearService({ model: 'gemini-3.5-flash-lite' });
    generar.mockResolvedValue(respuesta({ reportType: 'VENTAS', selectedFields: ['sucursal'], interpretacion: 'x' }));

    await service.interpretar('ventas');

    const peticion = generar.mock.calls[0][0] as { model: string; config: Record<string, unknown> };
    expect(peticion.model).toBe('gemini-3.5-flash-lite');
    expect(peticion.config.responseMimeType).toBe('application/json');
    expect(peticion.config.responseSchema).toBeDefined();
    // Las instrucciones nombran la tienda de la empresa actual.
    expect(String(peticion.config.systemInstruction)).toContain('Moda Andina');
  });

  it('arma el request validando los campos contra el catalogo real', async () => {
    const { service, generar } = crearService();
    generar.mockResolvedValue(
      respuesta({
        reportType: 'VENTAS',
        selectedFields: ['sucursal', 'monto_total', 'campo_inventado'],
        filters: [{ campo: 'sucursal', operador: 'eq', valor: 'La Paz' }],
        sort: { campo: 'monto_total', direccion: 'desc' },
        top: 5,
        interpretacion: 'Ventas de La Paz ordenadas por monto, generado con IA.',
      }),
    );

    const { request, interpretacion } = await service.interpretar('ventas de la paz, las que mas plata dejaron');

    expect(request.reportType).toBe('VENTAS');
    // "campo_inventado" no existe en el catalogo de VENTAS: se descarta aunque Gemini lo haya mandado.
    expect(request.selectedFields).toEqual(['sucursal', 'monto_total']);
    expect(request.filters).toEqual([{ campo: 'sucursal', operador: 'eq', valor: 'La Paz' }]);
    expect(request.sort).toEqual({ campo: 'monto_total', direccion: 'desc' });
    // Un top 5: la página es de 5 y el reporte no pasa de 5 filas.
    expect(request.top).toBe(5);
    expect(request.limit).toBe(5);
    expect(request.offset).toBe(0);
    expect(interpretacion).toBe('Ventas de La Paz ordenadas por monto, generado con IA.');
  });

  it('sin orden y sin la fecha en las columnas, ordena por la primera medida (antes daba 400)', async () => {
    const { service, generar } = crearService();
    // Típico de "ventas por sucursal": medidas sin fecha. El orden por defecto (fecha) el constructor lo rechazaba.
    generar.mockResolvedValue(respuesta({ reportType: 'VENTAS', selectedFields: ['sucursal', 'monto_total', 'cantidad'], interpretacion: 'x' }));

    const { request } = await service.interpretar('ventas por sucursal');

    expect(request.sort).toEqual({ campo: 'monto_total', direccion: 'desc' });
  });

  it('un orden por una columna que no está en el reporte se reemplaza por uno válido', async () => {
    const { service, generar } = crearService();
    generar.mockResolvedValue(
      respuesta({ reportType: 'VENTAS', selectedFields: ['producto', 'cantidad'], sort: { campo: 'codigo_nota', direccion: 'asc' }, interpretacion: 'x' }),
    );

    const { request } = await service.interpretar('productos más vendidos');

    expect(request.sort).toEqual({ campo: 'cantidad', direccion: 'desc' });
  });

  it('descarta filtros con valores u operadores inválidos en vez de fallar', async () => {
    const { service, generar } = crearService();
    generar.mockResolvedValue(
      respuesta({
        reportType: 'VENTAS',
        selectedFields: ['producto', 'monto_total'],
        filters: [
          { campo: 'monto_total', operador: 'gt', valor: 'mucho' },
          { campo: 'monto_total', operador: 'contains', valor: '100' },
          { campo: 'fecha_emision', operador: 'eq', valor: 'ayer' },
          { campo: 'cliente_identificado', operador: 'eq', valor: 'tal vez' },
          { campo: 'monto_total', operador: 'gte', valor: '150,5' },
          { campo: 'producto', operador: 'contains', valor: 'polera' },
        ],
        interpretacion: 'x',
      }),
    );

    const { request } = await service.interpretar('ventas grandes de poleras');

    expect(request.filters).toEqual([
      { campo: 'monto_total', operador: 'gte', valor: 150.5 },
      { campo: 'producto', operador: 'contains', valor: 'polera' },
    ]);
  });

  it('descarta fechas mal formadas o que no existen, y ordena un rango al revés', async () => {
    const { service, generar } = crearService();
    generar
      .mockResolvedValueOnce(respuesta({ reportType: 'VENTAS', selectedFields: ['sucursal'], dateFrom: '2026-02-30', dateTo: '11/2026', interpretacion: 'x' }))
      .mockResolvedValueOnce(respuesta({ reportType: 'VENTAS', selectedFields: ['sucursal'], dateFrom: '2026-11-10', dateTo: '2026-11-01', interpretacion: 'x' }));

    const invalidas = (await service.interpretar('ventas')).request;
    const alReves = (await service.interpretar('ventas')).request;

    expect(invalidas.dateFrom).toBeUndefined();
    expect(invalidas.dateTo).toBeUndefined();
    expect(alReves.dateFrom).toBe('2026-11-01');
    expect(alReves.dateTo).toBe('2026-11-10');
  });

  it('"los 20 clientes con más compras": top 20 (no una página de 20) y sin «Consumidor Final»', async () => {
    const { service, generar } = crearService();
    generar.mockResolvedValue(
      respuesta({ reportType: 'VENTAS', selectedFields: ['cliente', 'monto_total'], sort: { campo: 'monto_total', direccion: 'desc' }, top: 20, interpretacion: 'Top 20 de clientes.' }),
    );

    const { request, interpretacion } = await service.interpretar('listame los 20 clientes con mas compras');

    expect(request.top).toBe(20);
    expect(request.limit).toBe(20);
    expect(request.filters).toContainEqual({ campo: 'cliente_identificado', operador: 'eq', valor: true });
    expect(interpretacion).toContain('No incluye las ventas a «Consumidor Final»');
  });

  it('si lista notas de venta (no agrupa por cliente), no excluye a «Consumidor Final»', async () => {
    const { service, generar } = crearService();
    generar.mockResolvedValue(
      respuesta({
        reportType: 'VENTAS',
        selectedFields: ['codigo_nota', 'cliente', 'monto_total'],
        sort: { campo: 'monto_total', direccion: 'desc' },
        top: 10,
        interpretacion: 'Las 10 ventas más grandes.',
      }),
    );

    const { request, interpretacion } = await service.interpretar('las 10 compras de los clientes más caras');

    expect(request.filters).toEqual([]);
    expect(interpretacion).toBe('Las 10 ventas más grandes.');
  });

  it('si Gemini no manda el top, lo saca del pedido', async () => {
    const { service, generar } = crearService();
    generar.mockResolvedValue(respuesta({ reportType: 'VENTAS', selectedFields: ['producto', 'cantidad'], interpretacion: 'Top 20 de productos.' }));

    const { request } = await service.interpretar('los 20 productos que más se vendieron');

    expect(request.top).toBe(20);
  });

  it('sin una cantidad pedida no hay top, y la página es de 50', async () => {
    const { service, generar } = crearService();
    generar.mockResolvedValue(respuesta({ reportType: 'VENTAS', selectedFields: ['producto', 'cantidad'], interpretacion: 'x' }));

    const { request } = await service.interpretar('ventas de los 3 últimos meses por producto');

    expect(request.top).toBeUndefined();
    expect(request.limit).toBe(50);
  });

  it('si el pedido ya filtra por cliente identificado, no se agrega otro filtro', async () => {
    const { service, generar } = crearService();
    generar.mockResolvedValue(
      respuesta({
        reportType: 'VENTAS',
        selectedFields: ['cliente', 'monto_total'],
        filters: [{ campo: 'cliente_identificado', operador: 'eq', valor: 'false' }],
        top: 5,
        interpretacion: 'x',
      }),
    );

    const { request, interpretacion } = await service.interpretar('las 5 ventas más grandes a consumidor final');

    expect(request.filters).toEqual([{ campo: 'cliente_identificado', operador: 'eq', valor: false }]);
    expect(interpretacion).toBe('x');
  });

  it('descarta un filtro de sucursal que no existe en la BD (Gemini no debe poder inventar sedes)', async () => {
    const { service, generar } = crearService();
    generar.mockResolvedValue(
      respuesta({ reportType: 'VENTAS', selectedFields: ['sucursal'], filters: [{ campo: 'sucursal', operador: 'eq', valor: 'Sucursal Inventada' }], interpretacion: 'x' }),
    );

    const { request } = await service.interpretar('ventas de la sucursal inventada');

    expect(request.filters).toEqual([]);
  });

  it('nunca manda rango de fechas para INVENTARIO aunque Gemini lo intente', async () => {
    const { service, generar } = crearService();
    generar.mockResolvedValue(
      respuesta({ reportType: 'INVENTARIO', selectedFields: ['sucursal', 'stock_disponible'], dateFrom: '2026-01-01', dateTo: '2026-01-31', interpretacion: 'x' }),
    );

    const { request } = await service.interpretar('stock de enero');

    expect(request.dateFrom).toBeUndefined();
    expect(request.dateTo).toBeUndefined();
  });

  it('cae a los campos por defecto si Gemini no selecciona ninguno valido', async () => {
    const { service, generar } = crearService();
    generar.mockResolvedValue(respuesta({ reportType: 'COMPRAS', selectedFields: [], interpretacion: 'x' }));

    const { request } = await service.interpretar('compras');

    expect(request.selectedFields).toContain('proveedor');
  });

  it('propaga el error si Gemini falla con un status distinto de 503, sin reintentar', async () => {
    const { service, generar } = crearService();
    generar.mockRejectedValue(errorHttp(429));

    await expect(service.interpretar('ventas de hoy')).rejects.toThrow(/429/);
    expect(generar).toHaveBeenCalledTimes(1);
  });

  it('un 503 (alta demanda) se reintenta una vez y, si la segunda vez responde bien, funciona', async () => {
    const { service, generar } = crearService();
    generar.mockRejectedValueOnce(errorHttp(503)).mockResolvedValueOnce(respuesta({ reportType: 'VENTAS', selectedFields: ['sucursal'], interpretacion: 'ok tras reintento' }));

    const { interpretacion } = await service.interpretar('ventas de hoy');

    expect(interpretacion).toBe('ok tras reintento');
    expect(generar).toHaveBeenCalledTimes(2);
  }, 10_000);

  it('un 503 persistente se propaga tras el unico reintento', async () => {
    const { service, generar } = crearService();
    generar.mockRejectedValue(errorHttp(503));

    await expect(service.interpretar('ventas de hoy')).rejects.toThrow(/503/);
    expect(generar).toHaveBeenCalledTimes(2);
  }, 10_000);

  it('propaga el error si la respuesta no trae JSON valido o viene bloqueada', async () => {
    const { service, generar } = crearService();
    generar.mockResolvedValueOnce(respuesta('esto no es json')).mockResolvedValueOnce({ text: undefined, promptFeedback: { blockReason: 'SAFETY' } });

    await expect(service.interpretar('ventas de hoy')).rejects.toThrow(/JSON/);
    await expect(service.interpretar('ventas de hoy')).rejects.toThrow(/bloqueo/);
  });
});
