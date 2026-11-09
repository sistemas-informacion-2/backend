import { RegistroHerramientas } from './registro-herramientas.service.js';

type Filas = Array<Record<string, unknown>>;

function crear(filas: Filas | ((sql: string) => Filas) = [{ grupo: 'A', ventas: 10 }], falla?: Error) {
  const consultas: Array<{ sql: string; params?: unknown[] }> = [];
  const manager = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      consultas.push({ sql, params });
      if (sql.startsWith('SET')) return [];
      if (falla) throw falla;
      return typeof filas === 'function' ? filas(sql) : filas;
    }),
  };
  const dataSource = { transaction: vi.fn(async (cb: (m: typeof manager) => unknown) => cb(manager)) };
  const ml = { pronostico: vi.fn() };
  return { registro: new RegistroHerramientas(dataSource as never, ml as never), consultas, dataSource, ml };
}

const VENTAS = { desde: '2026-01-01', hasta: '2026-01-31', agrupar_por: 'mes' };

describe('RegistroHerramientas', () => {
  it('declara todas las herramientas en el formato de Gemini, con descripcion y requeridos validos', () => {
    const { registro } = crear();
    const declaraciones = registro.declaraciones();
    expect(declaraciones.length).toBe(24);
    expect(new Set(declaraciones.map((d) => d.name)).size).toBe(24);
    for (const declaracion of declaraciones) {
      expect(declaracion.description?.length).toBeGreaterThan(20);
      for (const requerido of declaracion.parameters?.required ?? []) expect(declaracion.parameters?.properties).toHaveProperty(requerido);
    }
    const ventas = declaraciones.find((d) => d.name === 'ventas_por_periodo');
    expect(ventas?.parameters?.type).toBe('OBJECT');
    expect(ventas?.parameters?.properties?.desde.type).toBe('STRING');
    expect(ventas?.parameters?.properties?.agrupar_por.enum).toContain('categoria');
  });

  it('consulta en una transaccion de solo lectura, con la empresa del token como primer parametro', async () => {
    const { registro, consultas } = crear();
    const ejecucion = await registro.ejecutar('ventas_por_periodo', VENTAS, 7, '2026-11-08');
    expect(ejecucion.ok).toBe(true);
    expect(consultas[0].sql).toBe('SET TRANSACTION READ ONLY');
    expect(consultas[1].sql).toContain('statement_timeout');
    expect(consultas[2].params?.[0]).toBe(7);
    expect(consultas[2].sql).toContain('v.id_empresa = $1');
  });

  it.each([
    ['un parametro que no existe, como la empresa', { ...VENTAS, id_empresa: 99 }, 'Parametro no permitido'],
    ['falta un requerido', { desde: '2026-01-01', hasta: '2026-01-31' }, 'Falta el parametro agrupar_por'],
    ['una fecha imposible', { ...VENTAS, hasta: '2026-02-31' }, 'fecha'],
    ['una agrupacion fuera de la lista', { ...VENTAS, agrupar_por: "mes; DROP TABLE x" }, 'debe ser uno de'],
    ['un periodo invertido', { ...VENTAS, desde: '2026-03-01' }, 'invalido'],
    ['un texto larguisimo', { ...VENTAS, sucursal: 'x'.repeat(200) }, 'largo'],
  ])('rechaza %s y se lo explica a Gemini, sin consultar', async (_caso, argumentos, mensaje) => {
    const { registro, dataSource, consultas } = crear();
    const ejecucion = await registro.ejecutar('ventas_por_periodo', argumentos, 7, '2026-11-08');
    expect(ejecucion.ok).toBe(false);
    expect(ejecucion.paraModelo.error).toContain(mensaje);
    if (mensaje !== 'invalido') expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(consultas.filter((c) => c.sql.includes('fact_ventas'))).toHaveLength(0);
  });

  it('una herramienta inexistente no rompe', async () => {
    const { registro } = crear();
    expect((await registro.ejecutar('borrar_todo', {}, 7, '2026-11-08')).paraModelo.error).toContain('no existe');
  });

  it('el texto de los filtros va como parametro y sin comodines', async () => {
    const { registro, consultas } = crear();
    await registro.ejecutar('ventas_por_periodo', { ...VENTAS, sucursal: "50%_'; DROP" }, 7, '2026-11-08');
    expect(consultas[2].sql).not.toContain('DROP');
    expect(consultas[2].params).toContain("%50\\%\\_'; DROP%");
  });

  it('un nombre de cliente va a la pantalla pero no a Google', async () => {
    const { registro } = crear((sql) => (sql.includes('GROUP BY nivel') ? [{ nivel: 'ALTO', clientes: 1 }] : [{ id_cliente: 5, nombre: 'Ana Quispe', probabilidad: 0.9, nivel: 'ALTO', factores: [] }]));
    const ejecucion = await registro.ejecutar('clientes_en_riesgo', {}, 7, '2026-11-08');
    expect((ejecucion.resultado as { filas: unknown[] }).filas[0]).toHaveProperty('nombre', 'Ana Quispe');
    expect(JSON.stringify(ejecucion.paraModelo)).not.toContain('Ana');
    expect((ejecucion.paraModelo.filas as unknown[])[0]).toHaveProperty('id_cliente', 5);
  });

  it('a Gemini le llega un maximo de filas, avisando', async () => {
    const { registro } = crear(Array.from({ length: 500 }, (_, i) => ({ grupo: i })));
    const { paraModelo } = await registro.ejecutar('ventas_por_periodo', VENTAS, 7, '2026-11-08');
    expect(paraModelo.filas).toHaveLength(200);
    expect(paraModelo.total_filas).toBe(500);
    expect(paraModelo.aviso).toBeDefined();
  });

  it('un error de la base no se filtra a Gemini', async () => {
    const { registro } = crear([], new Error('relation secreta does not exist'));
    const { ok, paraModelo } = await registro.ejecutar('ventas_por_periodo', VENTAS, 7, '2026-11-08');
    expect(ok).toBe(false);
    expect(JSON.stringify(paraModelo)).not.toContain('secreta');
  });

  it('sin modelos entrenados avisa en lugar de devolver una lista vacia sin mas', async () => {
    const { registro } = crear([]);
    const { paraModelo } = await registro.ejecutar('segmentos_de_clientes', {}, 7, '2026-11-08');
    expect(paraModelo.disponible).toBe(false);
    expect(paraModelo.nota).toContain('no se entrenaron');
  });

  it('un horizonte mayor al calculado pide el pronostico al servicio de ML, con la empresa del token', async () => {
    const { registro, ml } = crear();
    ml.pronostico.mockResolvedValue({ disponible: true, modelo: 'HOLT', mape: 0.1, puntos: [{ periodo: '2027-01-01', valor: 1, bajo: 0, alto: 2 }] });
    const ejecucion = await registro.ejecutar('pronosticar_ventas', { horizonte: 12 }, 7, '2026-11-08');
    expect(ml.pronostico).toHaveBeenCalledWith(expect.objectContaining({ idEmpresa: 7, ambito: 'TOTAL', frecuencia: 'MENSUAL', horizonte: 12 }));
    expect(ejecucion.ok).toBe(true);
  });

  it('el pronostico dentro del horizonte calculado lee la tabla, sin llamar a Python', async () => {
    const { registro, ml, consultas } = crear();
    await registro.ejecutar('pronosticar_ventas', { horizonte: 3 }, 7, '2026-11-08');
    expect(ml.pronostico).not.toHaveBeenCalled();
    expect(consultas[2].sql).toContain('dw.ml_pronostico');
  });
});
