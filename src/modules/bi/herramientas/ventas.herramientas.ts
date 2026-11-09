import { CATEGORIA, Consulta, DESDE, expresion, HASTA, LIMITE, SUCURSAL, validarRango, type ContextoHerramienta, type Herramienta, type ResultadoHerramienta } from './herramienta.js';

const FROM_VENTAS = `
  FROM dw.fact_ventas v
  JOIN dw.dim_fecha f ON f.fecha_key = v.fecha_key
  LEFT JOIN dw.dim_sucursal s ON s.id_sucursal = v.id_sucursal
  LEFT JOIN dw.dim_producto p ON p.id_variante = v.id_variante`;

const CANALES = ['MOSTRADOR', 'ONLINE', 'RESERVA'] as const;

const GRUPOS_TIEMPO: Record<string, string> = {
  dia: 'f.fecha::text',
  semana: '(f.fecha - (f.dia_semana - 1))::text',
  mes: "to_char(f.fecha, 'YYYY-MM')",
  trimestre: "f.anio || '-T' || f.trimestre",
  anio: 'f.anio::text',
};
const GRUPOS: Record<string, string> = {
  ...GRUPOS_TIEMPO,
  sucursal: 's.nombre',
  categoria: "COALESCE(p.categoria, 'Sin categoria')",
  categoria_padre: "COALESCE(p.categoria_padre, 'Sin categoria')",
  producto: "COALESCE(p.producto, 'Sin producto')",
  canal: 'v.canal',
  metodo_pago: "COALESCE(v.metodo_pago, 'Sin dato')",
  temporada: 'f.temporada',
  dia_semana: 'f.nombre_dia',
};

interface FiltrosVentas {
  desde: string;
  hasta: string;
  sucursal?: string;
  categoria?: string;
  canal?: string;
}

function whereVentas(q: Consulta, filtros: FiltrosVentas): string {
  validarRango(filtros.desde, filtros.hasta);
  const condiciones = ['v.id_empresa = $1', `f.fecha BETWEEN ${q.fecha(filtros.desde)} AND ${q.fecha(filtros.hasta)}`];
  if (filtros.sucursal) condiciones.push(q.contiene('s.nombre', filtros.sucursal));
  if (filtros.categoria) condiciones.push(q.contiene('p.categoria', filtros.categoria));
  if (filtros.canal) condiciones.push(`v.canal = ${q.valor(filtros.canal)}`);
  return `WHERE ${condiciones.join(' AND ')}`;
}

const ventasPorPeriodo: Herramienta<FiltrosVentas & { agrupar_por: string }> = {
  nombre: 'ventas_por_periodo',
  descripcion: 'Ventas (Bs, ya con descuentos e impuestos repartidos), unidades y tickets de un periodo, agrupadas por tiempo o por una dimension. Es la herramienta general para "cuanto vendi".',
  parametros: {
    desde: DESDE,
    hasta: HASTA,
    agrupar_por: { tipo: 'string', descripcion: 'Como agrupar', enum: Object.keys(GRUPOS) },
    sucursal: SUCURSAL,
    categoria: CATEGORIA,
    canal: { tipo: 'string', descripcion: 'Filtrar por canal', enum: CANALES },
  },
  requeridos: ['desde', 'hasta', 'agrupar_por'],
  async ejecutar(a, { idEmpresa, consultar }) {
    const q = new Consulta(idEmpresa);
    const grupo = expresion(GRUPOS, a.agrupar_por);
    const where = whereVentas(q, a);
    const orden = a.agrupar_por === 'dia_semana' ? 'MIN(f.dia_semana)' : a.agrupar_por in GRUPOS_TIEMPO ? '1' : 'ventas DESC';
    const filas = await consultar(
      `SELECT ${grupo} AS grupo, ROUND(SUM(v.importe_neto), 2)::float8 AS ventas, SUM(v.cantidad)::int AS unidades, COUNT(DISTINCT v.id_nota)::int AS tickets
       ${FROM_VENTAS} ${where} GROUP BY 1 ORDER BY ${orden}`,
      q.parametros,
    );
    return { filas };
  },
};

interface Totales {
  ventas: number;
  unidades: number;
  tickets: number;
  margen: number;
  ticket_promedio: number;
  devoluciones: number;
}

async function totales(desde: string, hasta: string, sucursal: string | undefined, { idEmpresa, consultar }: ContextoHerramienta): Promise<Totales> {
  const q = new Consulta(idEmpresa);
  const where = whereVentas(q, { desde, hasta, sucursal });
  const [ventas] = await consultar(
    `SELECT COALESCE(ROUND(SUM(v.importe_neto), 2), 0)::float8 AS ventas, COALESCE(SUM(v.cantidad), 0)::int AS unidades, COUNT(DISTINCT v.id_nota)::int AS tickets,
            COALESCE(ROUND(SUM(v.margen), 2), 0)::float8 AS margen
     ${FROM_VENTAS} ${where}`,
    q.parametros,
  );
  const qd = new Consulta(idEmpresa);
  const condiciones = ['d.id_empresa = $1', `f.fecha BETWEEN ${qd.fecha(desde)} AND ${qd.fecha(hasta)}`];
  if (sucursal) condiciones.push(qd.contiene('s.nombre', sucursal));
  const [devueltas] = await consultar(
    `SELECT COALESCE(ROUND(SUM(d.monto_reembolsado), 2), 0)::float8 AS devoluciones
       FROM dw.fact_devoluciones d JOIN dw.dim_fecha f ON f.fecha_key = d.fecha_key JOIN dw.dim_sucursal s ON s.id_sucursal = d.id_sucursal
      WHERE ${condiciones.join(' AND ')}`,
    qd.parametros,
  );
  const base = ventas as unknown as Omit<Totales, 'ticket_promedio' | 'devoluciones'>;
  return { ...base, ticket_promedio: base.tickets > 0 ? Math.round((base.ventas / base.tickets) * 100) / 100 : 0, devoluciones: Number(devueltas.devoluciones) };
}

function variacion(anterior: number, actual: number): number | null {
  return anterior === 0 ? null : Math.round(((actual - anterior) / anterior) * 1000) / 10;
}

interface ArgsComparacion {
  desde_a: string;
  hasta_a: string;
  desde_b: string;
  hasta_b: string;
  sucursal?: string;
}

const PERIODOS_A_B = {
  desde_a: { ...DESDE, descripcion: 'Inicio del periodo base, AAAA-MM-DD' },
  hasta_a: { ...HASTA, descripcion: 'Fin del periodo base, AAAA-MM-DD' },
  desde_b: { ...DESDE, descripcion: 'Inicio del periodo a comparar, AAAA-MM-DD' },
  hasta_b: { ...HASTA, descripcion: 'Fin del periodo a comparar, AAAA-MM-DD' },
};

const compararPeriodos: Herramienta<ArgsComparacion> = {
  nombre: 'comparar_periodos',
  descripcion: 'Compara dos periodos (A = base, B = el que se analiza): ventas, unidades, tickets, margen, ticket promedio, devoluciones y su variacion porcentual.',
  parametros: { ...PERIODOS_A_B, sucursal: SUCURSAL },
  requeridos: ['desde_a', 'hasta_a', 'desde_b', 'hasta_b'],
  async ejecutar(a, contexto) {
    const [base, comparado] = [await totales(a.desde_a, a.hasta_a, a.sucursal, contexto), await totales(a.desde_b, a.hasta_b, a.sucursal, contexto)];
    const filas = (Object.keys(base) as Array<keyof Totales>).map((metrica) => ({
      metrica,
      periodo_a: base[metrica],
      periodo_b: comparado[metrica],
      variacion_pct: variacion(base[metrica], comparado[metrica]),
    }));
    return { filas };
  },
};

const METRICAS_TOP: Record<string, string> = { ventas: 'SUM(v.importe_neto)', unidades: 'SUM(v.cantidad)', margen: 'SUM(v.margen)' };

const topProductos: Herramienta<FiltrosVentas & { por?: string; orden?: string; limite?: number }> = {
  nombre: 'top_productos',
  descripcion: 'Productos que mas (o menos) venden en un periodo, por ventas, unidades o margen.',
  parametros: {
    desde: DESDE,
    hasta: HASTA,
    por: { tipo: 'string', descripcion: 'Criterio; por defecto ventas', enum: Object.keys(METRICAS_TOP) },
    orden: { tipo: 'string', descripcion: 'mejores (por defecto) o peores', enum: ['mejores', 'peores'] },
    sucursal: SUCURSAL,
    categoria: CATEGORIA,
    limite: LIMITE,
  },
  requeridos: ['desde', 'hasta'],
  async ejecutar(a, { idEmpresa, consultar }) {
    const q = new Consulta(idEmpresa);
    const metrica = expresion(METRICAS_TOP, a.por ?? 'ventas');
    const where = whereVentas(q, a);
    const limite = q.entero(a.limite ?? 10);
    const filas = await consultar(
      `SELECT p.producto, p.categoria, ROUND(SUM(v.importe_neto), 2)::float8 AS ventas, SUM(v.cantidad)::int AS unidades, ROUND(SUM(v.margen), 2)::float8 AS margen
       ${FROM_VENTAS} ${where} AND p.producto IS NOT NULL
       GROUP BY p.producto, p.categoria ORDER BY ${metrica} ${a.orden === 'peores' ? 'ASC' : 'DESC'} LIMIT ${limite}`,
      q.parametros,
    );
    return { filas };
  },
};

const GRUPOS_SIMPLES: Record<string, string> = { total: "'Total'", mes: GRUPOS.mes, sucursal: GRUPOS.sucursal, canal: GRUPOS.canal };

const ticketPromedio: Herramienta<FiltrosVentas & { agrupar_por?: string }> = {
  nombre: 'ticket_promedio',
  descripcion: 'Ticket promedio (ventas / tickets) de un periodo, en total o por mes, sucursal o canal.',
  parametros: { desde: DESDE, hasta: HASTA, agrupar_por: { tipo: 'string', descripcion: 'Por defecto total', enum: Object.keys(GRUPOS_SIMPLES) }, sucursal: SUCURSAL },
  requeridos: ['desde', 'hasta'],
  async ejecutar(a, { idEmpresa, consultar }) {
    const q = new Consulta(idEmpresa);
    const grupo = expresion(GRUPOS_SIMPLES, a.agrupar_por ?? 'total');
    const where = whereVentas(q, a);
    const filas = await consultar(
      `SELECT ${grupo} AS grupo, COUNT(DISTINCT v.id_nota)::int AS tickets, ROUND(SUM(v.importe_neto) / NULLIF(COUNT(DISTINCT v.id_nota), 0), 2)::float8 AS ticket_promedio
       ${FROM_VENTAS} ${where} GROUP BY 1 ORDER BY 1`,
      q.parametros,
    );
    return { filas };
  },
};

const GRUPOS_MARGEN: Record<string, string> = { total: "'Total'", mes: GRUPOS.mes, sucursal: GRUPOS.sucursal, categoria: GRUPOS.categoria, producto: GRUPOS.producto, canal: GRUPOS.canal };

const margenPor: Herramienta<FiltrosVentas & { agrupar_por: string; limite?: number }> = {
  nombre: 'margen_por',
  descripcion: 'Margen bruto antes de devoluciones (ventas - costo) y su porcentaje, agrupado. Solo cuenta lineas con costo conocido e informa cuantas quedaron fuera.',
  parametros: { desde: DESDE, hasta: HASTA, agrupar_por: { tipo: 'string', descripcion: 'Como agrupar', enum: Object.keys(GRUPOS_MARGEN) }, sucursal: SUCURSAL, categoria: CATEGORIA, limite: LIMITE },
  requeridos: ['desde', 'hasta', 'agrupar_por'],
  async ejecutar(a, { idEmpresa, consultar }) {
    const q = new Consulta(idEmpresa);
    const grupo = expresion(GRUPOS_MARGEN, a.agrupar_por);
    const where = whereVentas(q, a);
    const limite = q.entero(a.limite ?? 50);
    const filas = await consultar(
      `SELECT ${grupo} AS grupo,
              ROUND(SUM(v.importe_neto) FILTER (WHERE v.costo_total IS NOT NULL), 2)::float8 AS ventas,
              ROUND(SUM(v.costo_total), 2)::float8 AS costo,
              ROUND(SUM(v.margen), 2)::float8 AS margen,
              ROUND(100 * SUM(v.margen) / NULLIF(SUM(v.importe_neto) FILTER (WHERE v.costo_total IS NOT NULL), 0), 1)::float8 AS margen_pct,
              COUNT(*) FILTER (WHERE v.costo_total IS NULL)::int AS lineas_sin_costo
       ${FROM_VENTAS} ${where} GROUP BY 1 ORDER BY ${a.agrupar_por === 'mes' ? '1' : 'margen DESC NULLS LAST'} LIMIT ${limite}`,
      q.parametros,
    );
    return { filas };
  },
};

const GRUPOS_DESCUENTO: Record<string, string> = { total: "'Total'", mes: GRUPOS.mes, sucursal: GRUPOS.sucursal, categoria: GRUPOS.categoria };

const descuentosOtorgados: Herramienta<FiltrosVentas & { agrupar_por?: string }> = {
  nombre: 'descuentos_otorgados',
  descripcion: 'Descuentos dados en un periodo (del producto y de la nota) y que porcentaje del precio de lista representan.',
  parametros: { desde: DESDE, hasta: HASTA, agrupar_por: { tipo: 'string', descripcion: 'Por defecto total', enum: Object.keys(GRUPOS_DESCUENTO) }, sucursal: SUCURSAL },
  requeridos: ['desde', 'hasta'],
  async ejecutar(a, { idEmpresa, consultar }) {
    const q = new Consulta(idEmpresa);
    const grupo = expresion(GRUPOS_DESCUENTO, a.agrupar_por ?? 'total');
    const where = whereVentas(q, a);
    const filas = await consultar(
      `SELECT ${grupo} AS grupo, ROUND(SUM(v.descuento_producto), 2)::float8 AS descuento_producto, ROUND(SUM(v.descuento_nota), 2)::float8 AS descuento_nota,
              ROUND(SUM(v.descuento_producto + v.descuento_nota), 2)::float8 AS descuento_total,
              ROUND(100 * SUM(v.descuento_producto + v.descuento_nota) / NULLIF(SUM(v.importe_bruto + v.descuento_producto), 0), 1)::float8 AS descuento_pct
       ${FROM_VENTAS} ${where} GROUP BY 1 ORDER BY 1`,
      q.parametros,
    );
    return { filas };
  },
};

const DIMENSIONES_VARIACION: Record<string, string> = { categoria: GRUPOS.categoria, sucursal: GRUPOS.sucursal, canal: GRUPOS.canal, producto: GRUPOS.producto };

const descomponerVariacion: Herramienta<ArgsComparacion & { dimension: string; limite?: number }> = {
  nombre: 'descomponer_variacion',
  descripcion: 'Explica una subida o caida de ventas entre dos periodos (A = base, B = analizado): cuanto aporto a la diferencia cada categoria, sucursal, canal o producto. Usar para preguntas de "por que".',
  parametros: { ...PERIODOS_A_B, dimension: { tipo: 'string', descripcion: 'Por donde abrir la diferencia', enum: Object.keys(DIMENSIONES_VARIACION) }, sucursal: SUCURSAL, limite: LIMITE },
  requeridos: ['desde_a', 'hasta_a', 'desde_b', 'hasta_b', 'dimension'],
  async ejecutar(a, { idEmpresa, consultar }) {
    validarRango(a.desde_a, a.hasta_a);
    validarRango(a.desde_b, a.hasta_b);
    const q = new Consulta(idEmpresa);
    const grupo = expresion(DIMENSIONES_VARIACION, a.dimension);
    const [a1, a2, b1, b2] = [q.fecha(a.desde_a), q.fecha(a.hasta_a), q.fecha(a.desde_b), q.fecha(a.hasta_b)];
    const sucursal = a.sucursal ? `AND ${q.contiene('s.nombre', a.sucursal)}` : '';
    const limite = q.entero(a.limite ?? 15);
    const filas = await consultar(
      `WITH base AS (
         SELECT ${grupo} AS grupo,
                COALESCE(SUM(v.importe_neto) FILTER (WHERE f.fecha BETWEEN ${a1} AND ${a2}), 0) AS a,
                COALESCE(SUM(v.importe_neto) FILTER (WHERE f.fecha BETWEEN ${b1} AND ${b2}), 0) AS b
         ${FROM_VENTAS}
         WHERE v.id_empresa = $1 AND (f.fecha BETWEEN ${a1} AND ${a2} OR f.fecha BETWEEN ${b1} AND ${b2}) ${sucursal}
         GROUP BY 1)
       SELECT grupo, ROUND(a, 2)::float8 AS ventas_a, ROUND(b, 2)::float8 AS ventas_b, ROUND(b - a, 2)::float8 AS diferencia,
              ROUND(100 * (b - a) / NULLIF(SUM(b - a) OVER (), 0), 1)::float8 AS aporte_pct
         FROM base ORDER BY ABS(b - a) DESC LIMIT ${limite}`,
      q.parametros,
    );
    return { filas, nota: 'aporte_pct es la parte de la diferencia total que explica cada grupo; si los grupos se mueven en sentidos opuestos puede superar 100.' };
  },
};

const GRUPOS_DEVOLUCION: Record<string, string> = { total: "'Total'", mes: GRUPOS.mes, categoria: GRUPOS.categoria, producto: GRUPOS.producto, sucursal: GRUPOS.sucursal };

const tasaDevolucion: Herramienta<{ desde: string; hasta: string; agrupar_por?: string; limite?: number }> = {
  nombre: 'tasa_devolucion',
  descripcion: 'Unidades devueltas sobre vendidas y monto reembolsado de un periodo, en total o por mes, categoria, producto o sucursal; con agrupar_por=motivo, cuantas devoluciones hubo por cada motivo.',
  parametros: { desde: DESDE, hasta: HASTA, agrupar_por: { tipo: 'string', descripcion: 'Por defecto total', enum: [...Object.keys(GRUPOS_DEVOLUCION), 'motivo'] }, limite: LIMITE },
  requeridos: ['desde', 'hasta'],
  async ejecutar(a, { idEmpresa, consultar }): Promise<ResultadoHerramienta> {
    validarRango(a.desde, a.hasta);
    const q = new Consulta(idEmpresa);
    const [desde, hasta] = [q.fecha(a.desde), q.fecha(a.hasta)];
    const limite = q.entero(a.limite ?? 30);
    const fromDev = `FROM dw.fact_devoluciones d JOIN dw.dim_fecha f ON f.fecha_key = d.fecha_key
      LEFT JOIN dw.dim_sucursal s ON s.id_sucursal = d.id_sucursal LEFT JOIN dw.dim_producto p ON p.id_variante = d.id_variante
      WHERE d.id_empresa = $1 AND f.fecha BETWEEN ${desde} AND ${hasta}`;
    if (a.agrupar_por === 'motivo') {
      const filas = await consultar(
        `SELECT d.motivo AS grupo, SUM(d.cantidad)::int AS unidades_devueltas, ROUND(SUM(d.monto_reembolsado), 2)::float8 AS monto_reembolsado ${fromDev} GROUP BY 1 ORDER BY 2 DESC LIMIT ${limite}`,
        q.parametros,
      );
      return { filas };
    }
    const grupo = expresion(GRUPOS_DEVOLUCION, a.agrupar_por ?? 'total');
    const filas = await consultar(
      `WITH vendidas AS (SELECT ${grupo} AS grupo, SUM(v.cantidad) AS unidades ${FROM_VENTAS} WHERE v.id_empresa = $1 AND f.fecha BETWEEN ${desde} AND ${hasta} GROUP BY 1),
            devueltas AS (SELECT ${grupo} AS grupo, SUM(d.cantidad) AS unidades, SUM(d.monto_reembolsado) AS monto ${fromDev} GROUP BY 1)
       SELECT COALESCE(x.grupo, y.grupo) AS grupo, COALESCE(x.unidades, 0)::int AS unidades_vendidas, COALESCE(y.unidades, 0)::int AS unidades_devueltas,
              COALESCE(ROUND(y.monto, 2), 0)::float8 AS monto_reembolsado, ROUND(100.0 * COALESCE(y.unidades, 0) / NULLIF(x.unidades, 0), 2)::float8 AS tasa_pct
         FROM vendidas x FULL JOIN devueltas y ON y.grupo = x.grupo
        ORDER BY ${a.agrupar_por === 'mes' ? '1' : '3 DESC'} LIMIT ${limite}`,
      q.parametros,
    );
    return { filas, nota: 'Las devoluciones cuentan en la fecha en que se hicieron, no en la de la venta.' };
  },
};

export const HERRAMIENTAS_VENTAS = [ventasPorPeriodo, compararPeriodos, topProductos, ticketPromedio, margenPor, descuentosOtorgados, descomponerVariacion, tasaDevolucion];
