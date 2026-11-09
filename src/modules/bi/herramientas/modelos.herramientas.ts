import { CATEGORIA, conAvisoDeModelos, Consulta, DESDE, ErrorDeParametros, HASTA, LIMITE, SUCURSAL, validarRango, type ContextoHerramienta, type Herramienta, type ResultadoHerramienta } from './herramienta.js';

const CALCULADOS = { MENSUAL: 6, SEMANAL: 12 } as const;

const anomaliasRecientes: Herramienta<{ desde?: string; hasta?: string; sucursal?: string; limite?: number }> = {
  nombre: 'anomalias_recientes',
  descripcion: 'Dias atipicos por sucursal detectados por machine learning (no supervisado): tickets presenciales reales frente a los esperados.',
  parametros: { desde: DESDE, hasta: HASTA, sucursal: SUCURSAL, limite: LIMITE },
  async ejecutar(args, contexto) {
    if (args.desde && args.hasta) validarRango(args.desde, args.hasta);
    const q = new Consulta(contexto.idEmpresa);
    const condiciones = ['x.id_empresa = $1'];
    if (args.desde) condiciones.push(`x.fecha >= ${q.fecha(args.desde)}`);
    if (args.hasta) condiciones.push(`x.fecha <= ${q.fecha(args.hasta)}`);
    if (args.sucursal) condiciones.push(q.contiene('s.nombre', args.sucursal));
    const limite = q.entero(args.limite ?? 20);
    const filas = await contexto.consultar(
      `SELECT x.fecha::text AS fecha, s.nombre AS sucursal, x.metrica, x.valor_real::float8 AS valor_real, x.valor_esperado::float8 AS valor_esperado, x.desviacion::float8 AS desviacion, x.gravedad, d.nombre_dia, d.nombre_feriado
         FROM dw.ml_anomalia x
         JOIN dw.dim_sucursal s ON s.id_sucursal = x.id_sucursal
         JOIN dw.dim_fecha d ON d.fecha = x.fecha
        WHERE ${condiciones.join(' AND ')} ORDER BY x.fecha DESC LIMIT ${limite}`,
      q.parametros,
    );
    return conAvisoDeModelos(contexto, filas, { nota: 'Una anomalia indica que el dia fue raro, no su causa. No inventes el motivo.' });
  },
};

const segmentos: Herramienta<object> = {
  nombre: 'segmentos_de_clientes',
  descripcion: 'Grupos de clientes encontrados por machine learning (no supervisado, K-means sobre recencia, frecuencia y monto), con su tamanio y su comportamiento promedio.',
  parametros: {},
  async ejecutar(_args, contexto) {
    const filas = await contexto.consultar(
      `SELECT segmento, COUNT(*)::int AS clientes, ROUND(AVG(recencia_dias))::int AS recencia_dias_promedio, ROUND(AVG(frecuencia), 1)::float8 AS compras_promedio, ROUND(AVG(monto), 2)::float8 AS monto_promedio
         FROM dw.ml_segmento_cliente WHERE id_empresa = $1 GROUP BY segmento ORDER BY clientes DESC`,
      [contexto.idEmpresa],
    );
    return conAvisoDeModelos(contexto, filas);
  },
};

const clientesEnRiesgo: Herramienta<{ nivel?: string; limite?: number }> = {
  nombre: 'clientes_en_riesgo',
  descripcion: 'Clientes con mas probabilidad de no volver a comprar en 90 dias (machine learning supervisado), con los principales factores. El resumen trae cuantos hay por nivel. Los clientes llegan por id: refierete a ellos por id.',
  parametros: { nivel: { tipo: 'string', descripcion: 'Filtrar por nivel de riesgo', enum: ['ALTO', 'MEDIO', 'BAJO'] }, limite: LIMITE },
  async ejecutar(args, contexto): Promise<ResultadoHerramienta> {
    const q = new Consulta(contexto.idEmpresa);
    const nivel = args.nivel ? `AND x.nivel = ${q.valor(args.nivel)}` : '';
    const limite = q.entero(args.limite ?? 20);
    const filas = await contexto.consultar(
      `SELECT x.id_cliente, c.nombre, c.ciudad, x.probabilidad::float8 AS probabilidad, x.nivel, x.factores
         FROM dw.ml_riesgo_abandono x JOIN dw.dim_cliente c ON c.id_cliente = x.id_cliente
        WHERE x.id_empresa = $1 ${nivel} ORDER BY x.probabilidad DESC, x.id_cliente LIMIT ${limite}`,
      q.parametros,
    );
    const niveles = await contexto.consultar(`SELECT nivel, COUNT(*)::int AS clientes FROM dw.ml_riesgo_abandono WHERE id_empresa = $1 GROUP BY nivel ORDER BY nivel`, [contexto.idEmpresa]);
    return conAvisoDeModelos(contexto, filas, { resumen: { por_nivel: niveles }, columnasPrivadas: ['nombre'] });
  },
};

async function pronosticoAlMomento(args: ArgsPronostico, frecuencia: 'MENSUAL' | 'SEMANAL', horizonte: number, ambito: 'TOTAL' | 'SUCURSAL' | 'CATEGORIA', clave: string | undefined, contexto: ContextoHerramienta): Promise<ResultadoHerramienta> {
  const respuesta = await contexto.ml.pronostico({ idEmpresa: contexto.idEmpresa, ambito, clave, frecuencia, horizonte });
  if (!respuesta.disponible || !respuesta.puntos) {
    return { filas: [], disponible: false, nota: `${respuesta.motivo ?? 'No disponible'}. Pide un horizonte de hasta ${CALCULADOS[frecuencia]} periodos o dilo asi.` };
  }
  return { filas: respuesta.puntos, resumen: { modelo: respuesta.modelo, mape: respuesta.mape, filtro: args.sucursal ?? args.categoria ?? 'Total' }, nota: 'bajo y alto son un rango aproximado del 80%. Montos en Bs.' };
}

interface ArgsPronostico {
  frecuencia?: 'MENSUAL' | 'SEMANAL';
  horizonte?: number;
  sucursal?: string;
  categoria?: string;
}

const pronosticarVentas: Herramienta<ArgsPronostico> = {
  nombre: 'pronosticar_ventas',
  descripcion: 'Ventas futuras en Bs con un rango del 80% (machine learning supervisado), de la empresa, de una sucursal o de una categoria.',
  parametros: {
    frecuencia: { tipo: 'string', descripcion: 'Por defecto MENSUAL', enum: ['MENSUAL', 'SEMANAL'] },
    horizonte: { tipo: 'integer', descripcion: 'Periodos hacia adelante; por defecto 6 meses o 12 semanas', minimo: 1, maximo: 24 },
    sucursal: SUCURSAL,
    categoria: CATEGORIA,
  },
  async ejecutar(args, contexto) {
    if (args.sucursal && args.categoria) throw new ErrorDeParametros('Elige una sucursal o una categoria, no ambas');
    const frecuencia = args.frecuencia ?? 'MENSUAL';
    const horizonte = args.horizonte ?? CALCULADOS[frecuencia];

    let ambito: 'TOTAL' | 'SUCURSAL' | 'CATEGORIA' = 'TOTAL';
    let clave: string | undefined;
    if (args.sucursal) {
      const q = new Consulta(contexto.idEmpresa);
      const encontradas = await contexto.consultar(`SELECT id_sucursal, nombre FROM dw.dim_sucursal WHERE id_empresa = $1 AND ${q.contiene('nombre', args.sucursal)} LIMIT 2`, q.parametros);
      if (encontradas.length !== 1) throw new ErrorDeParametros(`"${args.sucursal}" no identifica a una sola sucursal; revisa la herramienta catalogos`);
      ambito = 'SUCURSAL';
      clave = String(encontradas[0].id_sucursal);
    } else if (args.categoria) {
      const q = new Consulta(contexto.idEmpresa);
      const encontradas = await contexto.consultar(`SELECT DISTINCT categoria FROM dw.dim_producto WHERE id_empresa = $1 AND ${q.contiene('categoria', args.categoria)} LIMIT 2`, q.parametros);
      if (encontradas.length !== 1) throw new ErrorDeParametros(`"${args.categoria}" no identifica a una sola categoria; revisa la herramienta catalogos`);
      ambito = 'CATEGORIA';
      clave = String(encontradas[0].categoria);
    }

    if (horizonte > CALCULADOS[frecuencia]) return pronosticoAlMomento(args, frecuencia, horizonte, ambito, clave, contexto);

    const q = new Consulta(contexto.idEmpresa);
    const filas = await contexto.consultar(
      `SELECT periodo::text AS periodo, valor::float8 AS valor, bajo::float8 AS bajo, alto::float8 AS alto, modelo
         FROM dw.ml_pronostico
        WHERE id_empresa = $1 AND ambito = ${q.valor(ambito)} AND clave = ${q.valor(clave ?? 'TOTAL')} AND frecuencia = ${q.valor(frecuencia)}
        ORDER BY periodo LIMIT ${q.entero(horizonte)}`,
      q.parametros,
    );
    return conAvisoDeModelos(contexto, filas, { nota: 'bajo y alto son un rango aproximado del 80%. Montos en Bs.' });
  },
};

const sugerenciaDeCompra: Herramienta<{ sucursal?: string; categoria?: string; limite?: number }> = {
  nombre: 'sugerencia_de_compra',
  descripcion: 'Que variantes reponer y cuantas unidades comprar para los proximos 2 meses, segun el pronostico de demanda, el stock actual y un stock de seguridad.',
  parametros: { sucursal: SUCURSAL, categoria: CATEGORIA, limite: LIMITE },
  async ejecutar(args, contexto) {
    const q = new Consulta(contexto.idEmpresa);
    const filtros = [args.sucursal ? q.contiene('s.nombre', args.sucursal) : null, args.categoria ? q.contiene('p.categoria', args.categoria) : null].filter(Boolean);
    const limite = q.entero(args.limite ?? 20);
    const filas = await contexto.consultar(
      `SELECT p.producto, p.categoria, p.sku, p.talla, p.color, s.nombre AS sucursal, x.demanda_esperada::float8 AS demanda_esperada, x.stock_actual, x.stock_seguridad::float8 AS stock_seguridad, x.cantidad_sugerida
         FROM dw.ml_sugerencia_compra x
         JOIN dw.dim_producto p ON p.id_variante = x.id_variante
         JOIN dw.dim_sucursal s ON s.id_sucursal = x.id_sucursal
        WHERE x.id_empresa = $1 ${filtros.length ? `AND ${filtros.join(' AND ')}` : ''}
        ORDER BY x.cantidad_sugerida DESC LIMIT ${limite}`,
      q.parametros,
    );
    return conAvisoDeModelos(contexto, filas);
  },
};

const productosJuntos: Herramienta<{ producto?: string; limite?: number }> = {
  nombre: 'productos_que_se_compran_juntos',
  descripcion: 'Productos que se compran juntos (machine learning no supervisado, Apriori). confianza: probabilidad de llevar B si lleva A. lift mayor a 1: se compran juntos mas de lo esperable por azar.',
  parametros: { producto: { tipo: 'string', descripcion: 'Parte del nombre del producto A. Omitir para ver todos' }, limite: LIMITE },
  async ejecutar(args, contexto) {
    const q = new Consulta(contexto.idEmpresa);
    const producto = args.producto ? `AND ${q.contiene('producto_a', args.producto)}` : '';
    const limite = q.entero(args.limite ?? 15);
    const filas = await contexto.consultar(
      `SELECT producto_a, producto_b, soporte::float8 AS soporte, confianza::float8 AS confianza, lift::float8 AS lift, notas
         FROM dw.ml_asociacion WHERE id_empresa = $1 ${producto} ORDER BY lift DESC, notas DESC LIMIT ${limite}`,
      q.parametros,
    );
    return conAvisoDeModelos(contexto, filas);
  },
};

export const HERRAMIENTAS_MODELOS = [anomaliasRecientes, segmentos, clientesEnRiesgo, pronosticarVentas, sugerenciaDeCompra, productosJuntos];
