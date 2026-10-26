import { GeminiReporteService } from './gemini-reporte.service.js';

function crearService(cfg: { apiKey?: string; model?: string } = {}, sucursales: string[] = ['La Paz', 'Santa Cruz']) {
  const valores: Record<string, unknown> = { 'gemini.apiKey': cfg.apiKey ?? 'clave-de-prueba', 'gemini.model': cfg.model ?? 'gemini-2.5-flash' };
  const config = { get: (clave: string) => valores[clave] };
  const dataSource = { query: vi.fn().mockResolvedValue(sucursales.map((nombre) => ({ nombre }))) };
  return { service: new GeminiReporteService(config as never, dataSource as never), dataSource };
}

function respuestaGemini(jsonTexto: string) {
  return { ok: true, status: 200, statusText: 'OK', json: async () => ({ candidates: [{ content: { parts: [{ text: jsonTexto }] } }] }), text: async () => '' };
}

describe('GeminiReporteService', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('disponible es false sin API key', () => {
    const { service } = crearService({ apiKey: '' });
    expect(service.disponible).toBe(false);
  });

  it('interpretar rechaza si no hay API key, sin llamar a fetch', async () => {
    const { service } = crearService({ apiKey: '' });
    await expect(service.interpretar('ventas de hoy')).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('arma el request validando los campos contra el catalogo real', async () => {
    const { service } = crearService();
    fetchMock.mockResolvedValue(
      respuestaGemini(
        JSON.stringify({
          reportType: 'VENTAS',
          selectedFields: ['sucursal', 'monto_total', 'campo_inventado'],
          filters: [{ campo: 'sucursal', operador: 'eq', valor: 'La Paz' }],
          sort: { campo: 'monto_total', direccion: 'desc' },
          limit: 5,
          interpretacion: 'Ventas de La Paz ordenadas por monto, generado con IA.',
        }),
      ),
    );

    const { request, interpretacion } = await service.interpretar('ventas de la paz, las que mas plata dejaron');

    expect(request.reportType).toBe('VENTAS');
    // "campo_inventado" no existe en el catalogo de VENTAS: se descarta aunque Gemini lo haya mandado.
    expect(request.selectedFields).toEqual(['sucursal', 'monto_total']);
    expect(request.filters).toEqual([{ campo: 'sucursal', operador: 'eq', valor: 'La Paz' }]);
    expect(request.sort).toEqual({ campo: 'monto_total', direccion: 'desc' });
    expect(request.limit).toBe(5);
    expect(request.offset).toBe(0);
    expect(interpretacion).toBe('Ventas de La Paz ordenadas por monto, generado con IA.');

    const [, opciones] = fetchMock.mock.calls[0] as [string, { body: string }];
    const cuerpoEnviado = JSON.parse(opciones.body);
    expect(cuerpoEnviado.generationConfig.responseMimeType).toBe('application/json');
  });

  it('descarta un filtro de sucursal que no existe en la BD (Gemini no debe poder inventar sedes)', async () => {
    const { service } = crearService();
    fetchMock.mockResolvedValue(
      respuestaGemini(
        JSON.stringify({
          reportType: 'VENTAS',
          selectedFields: ['sucursal'],
          filters: [{ campo: 'sucursal', operador: 'eq', valor: 'Sucursal Inventada' }],
          interpretacion: 'x',
        }),
      ),
    );

    const { request } = await service.interpretar('ventas de la sucursal inventada');

    expect(request.filters).toEqual([]);
  });

  it('nunca manda rango de fechas para INVENTARIO aunque Gemini lo intente', async () => {
    const { service } = crearService();
    fetchMock.mockResolvedValue(
      respuestaGemini(
        JSON.stringify({
          reportType: 'INVENTARIO',
          selectedFields: ['sucursal', 'stock_disponible'],
          dateFrom: '2026-01-01',
          dateTo: '2026-01-31',
          interpretacion: 'x',
        }),
      ),
    );

    const { request } = await service.interpretar('stock de enero');

    expect(request.dateFrom).toBeUndefined();
    expect(request.dateTo).toBeUndefined();
  });

  it('cae a los campos por defecto si Gemini no selecciona ninguno valido', async () => {
    const { service } = crearService();
    fetchMock.mockResolvedValue(respuestaGemini(JSON.stringify({ reportType: 'COMPRAS', selectedFields: [], interpretacion: 'x' })));

    const { request } = await service.interpretar('compras');

    expect(request.selectedFields.length).toBeGreaterThan(0);
    expect(request.selectedFields).toContain('proveedor');
  });

  it('propaga el error si Gemini responde con un status distinto de 200', async () => {
    const { service } = crearService();
    fetchMock.mockResolvedValue({ ok: false, status: 429, statusText: 'Too Many Requests', text: async () => 'quota exceeded' });

    await expect(service.interpretar('ventas de hoy')).rejects.toThrow(/429/);
  });

  it('propaga el error si la respuesta no trae JSON valido', async () => {
    const { service } = crearService();
    fetchMock.mockResolvedValue(respuestaGemini('esto no es json'));

    await expect(service.interpretar('ventas de hoy')).rejects.toThrow(/JSON/);
  });
});
