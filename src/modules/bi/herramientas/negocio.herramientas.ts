import { Consulta, DESDE, HASTA, SUCURSAL, validarRango, visualAgrupado, type Herramienta } from './herramienta.js';

const clientesNuevos: Herramienta<{ desde: string; hasta: string }> = {
  nombre: 'clientes_nuevos_y_recurrencia',
  visual: () => ({ titulo: 'Clientes nuevos y recurrencia', tipo: 'tabla' }),
  descripcion: 'En un periodo: clientes que compraron, nuevos (su primera compra cae en el periodo), recurrentes (2 o mas compras) y porcentaje de recurrencia. No cuenta al consumidor final.',
  parametros: { desde: DESDE, hasta: HASTA },
  requeridos: ['desde', 'hasta'],
  async ejecutar(args, { idEmpresa, consultar }) {
    validarRango(args.desde, args.hasta);
    const q = new Consulta(idEmpresa);
    const [desde, hasta] = [q.fecha(args.desde), q.fecha(args.hasta)];
    const filas = await consultar(
      `WITH notas AS (
         SELECT v.id_cliente, v.id_nota, MIN(f.fecha) AS fecha
           FROM dw.fact_ventas v JOIN dw.dim_fecha f ON f.fecha_key = v.fecha_key JOIN dw.dim_cliente c ON c.id_cliente = v.id_cliente
          WHERE v.id_empresa = $1 AND NOT c.es_consumidor_final GROUP BY 1, 2),
       primera AS (SELECT id_cliente, MIN(fecha) AS fecha FROM notas GROUP BY 1),
       periodo AS (SELECT id_cliente, COUNT(*) AS compras FROM notas WHERE fecha BETWEEN ${desde} AND ${hasta} GROUP BY 1)
       SELECT COUNT(*)::int AS clientes_que_compraron,
              (SELECT COUNT(*) FROM primera WHERE fecha BETWEEN ${desde} AND ${hasta})::int AS clientes_nuevos,
              COUNT(*) FILTER (WHERE compras >= 2)::int AS clientes_recurrentes,
              ROUND(100.0 * COUNT(*) FILTER (WHERE compras >= 2) / NULLIF(COUNT(*), 0), 1)::float8 AS recurrencia_pct
         FROM periodo`,
      q.parametros,
    );
    return { filas };
  },
};

const GRUPOS_FINANZAS: Record<string, { pagos: string; gastos: string }> = {
  total: { pagos: "'Total'", gastos: "'Total'" },
  mes: { pagos: "to_char(f.fecha, 'YYYY-MM')", gastos: "to_char(f.fecha, 'YYYY-MM')" },
  sucursal: { pagos: "COALESCE(s.nombre, 'Sin sucursal')", gastos: 's.nombre' },
};

const ingresosYGastos: Herramienta<{ desde: string; hasta: string; agrupar_por?: string }> = {
  nombre: 'ingresos_y_gastos',
  visual: (a) => visualAgrupado('Ingresos y gastos', a.agrupar_por, ['ingresos', 'gastos_operativos']),
  descripcion: 'Dinero cobrado (pagos menos reembolsos, incluida la tienda en linea) frente a gastos operativos. Es flujo de dinero: no incluye el costo de la mercaderia vendida; para ganancia usar resultado_del_periodo.',
  parametros: { desde: DESDE, hasta: HASTA, agrupar_por: { tipo: 'string', descripcion: 'Por defecto total', enum: Object.keys(GRUPOS_FINANZAS) } },
  requeridos: ['desde', 'hasta'],
  async ejecutar(args, { idEmpresa, consultar }) {
    validarRango(args.desde, args.hasta);
    const grupos = GRUPOS_FINANZAS[args.agrupar_por ?? 'total'];
    const q = new Consulta(idEmpresa);
    const [desde, hasta] = [q.fecha(args.desde), q.fecha(args.hasta)];
    const filas = await consultar(
      `WITH ingresos AS (
         SELECT ${grupos.pagos} AS grupo, SUM(x.monto_neto) AS monto
           FROM dw.fact_pagos x JOIN dw.dim_fecha f ON f.fecha_key = x.fecha_key LEFT JOIN dw.dim_sucursal s ON s.id_sucursal = x.id_sucursal
          WHERE x.id_empresa = $1 AND f.fecha BETWEEN ${desde} AND ${hasta} GROUP BY 1),
       gastos AS (
         SELECT ${grupos.gastos} AS grupo, SUM(x.monto) AS monto
           FROM dw.fact_gastos x JOIN dw.dim_fecha f ON f.fecha_key = x.fecha_key JOIN dw.dim_sucursal s ON s.id_sucursal = x.id_sucursal
          WHERE x.id_empresa = $1 AND x.categoria = 'GASTO_OPERATIVO' AND f.fecha BETWEEN ${desde} AND ${hasta} GROUP BY 1)
       SELECT COALESCE(i.grupo, g.grupo) AS grupo, COALESCE(ROUND(i.monto, 2), 0)::float8 AS ingresos, COALESCE(ROUND(g.monto, 2), 0)::float8 AS gastos_operativos,
              ROUND(COALESCE(i.monto, 0) - COALESCE(g.monto, 0), 2)::float8 AS saldo
         FROM ingresos i FULL JOIN gastos g ON g.grupo = i.grupo ORDER BY 1`,
      q.parametros,
    );
    return { filas };
  },
};

const gastosPorTipo: Herramienta<{ desde: string; hasta: string; sucursal?: string }> = {
  nombre: 'gastos_por_tipo',
  visual: () => ({ titulo: 'Gastos por tipo', tipo: 'barras', x: 'tipo', series: ['monto'] }),
  descripcion: 'Gastos y egresos manuales de caja por categoria y tipo (alquiler, sueldos, servicios, marketing...). Los RETIRO son del duenio y no son gasto del negocio.',
  parametros: { desde: DESDE, hasta: HASTA, sucursal: SUCURSAL },
  requeridos: ['desde', 'hasta'],
  async ejecutar(args, { idEmpresa, consultar }) {
    validarRango(args.desde, args.hasta);
    const q = new Consulta(idEmpresa);
    const [desde, hasta] = [q.fecha(args.desde), q.fecha(args.hasta)];
    const sucursal = args.sucursal ? `AND ${q.contiene('s.nombre', args.sucursal)}` : '';
    const filas = await consultar(
      `SELECT x.categoria, COALESCE(x.subcategoria, '-') AS tipo, ROUND(SUM(x.monto), 2)::float8 AS monto, COUNT(*)::int AS movimientos
         FROM dw.fact_gastos x JOIN dw.dim_fecha f ON f.fecha_key = x.fecha_key JOIN dw.dim_sucursal s ON s.id_sucursal = x.id_sucursal
        WHERE x.id_empresa = $1 AND f.fecha BETWEEN ${desde} AND ${hasta} ${sucursal}
        GROUP BY 1, 2 ORDER BY monto DESC`,
      q.parametros,
    );
    return { filas };
  },
};

const resultado: Herramienta<{ desde: string; hasta: string; sucursal?: string }> = {
  nombre: 'resultado_del_periodo',
  visual: () => ({ titulo: 'Resultado del período', tipo: 'tabla' }),
  descripcion: 'Estado de resultados simplificado: ventas, devoluciones, ventas netas, costo de ventas, costo recuperado, margen bruto, gastos operativos y resultado. Responde "cuanto gane".',
  parametros: { desde: DESDE, hasta: HASTA, sucursal: SUCURSAL },
  requeridos: ['desde', 'hasta'],
  async ejecutar(args, { idEmpresa, consultar }) {
    validarRango(args.desde, args.hasta);
    const q = new Consulta(idEmpresa);
    const [desde, hasta] = [q.fecha(args.desde), q.fecha(args.hasta)];
    const sucursal = args.sucursal ? `AND ${q.contiene('s.nombre', args.sucursal)}` : '';
    const tiempo = `JOIN dw.dim_fecha f ON f.fecha_key = x.fecha_key JOIN dw.dim_sucursal s ON s.id_sucursal = x.id_sucursal`;
    const periodo = `x.id_empresa = $1 AND f.fecha BETWEEN ${desde} AND ${hasta} ${sucursal}`;
    const [fila] = await consultar(
      `SELECT
         (SELECT COALESCE(SUM(x.importe_neto), 0) FROM dw.fact_ventas x ${tiempo} WHERE ${periodo})::float8 AS ventas,
         (SELECT COALESCE(SUM(x.costo_total), 0) FROM dw.fact_ventas x ${tiempo} WHERE ${periodo})::float8 AS costo_ventas,
         (SELECT COUNT(*) FROM dw.fact_ventas x ${tiempo} WHERE ${periodo} AND x.costo_total IS NULL)::int AS lineas_sin_costo,
         (SELECT COALESCE(SUM(x.monto_reembolsado), 0) FROM dw.fact_devoluciones x ${tiempo} WHERE ${periodo})::float8 AS devoluciones,
         (SELECT COALESCE(SUM(x.costo_recuperado), 0) FROM dw.fact_devoluciones x ${tiempo} WHERE ${periodo})::float8 AS costo_recuperado,
         (SELECT COALESCE(SUM(x.monto), 0) FROM dw.fact_gastos x ${tiempo} WHERE ${periodo} AND x.categoria = 'GASTO_OPERATIVO')::float8 AS gastos_operativos`,
      q.parametros,
    );
    const v = fila as Record<'ventas' | 'costo_ventas' | 'devoluciones' | 'costo_recuperado' | 'gastos_operativos' | 'lineas_sin_costo', number>;
    const redondear = (n: number) => Math.round(n * 100) / 100;
    const ventasNetas = v.ventas - v.devoluciones;
    const margenBruto = ventasNetas - (v.costo_ventas - v.costo_recuperado);
    return {
      filas: [
        { concepto: 'Ventas', monto: redondear(v.ventas) },
        { concepto: 'Devoluciones', monto: redondear(-v.devoluciones) },
        { concepto: 'Ventas netas', monto: redondear(ventasNetas) },
        { concepto: 'Costo de ventas', monto: redondear(-v.costo_ventas) },
        { concepto: 'Costo recuperado por devoluciones', monto: redondear(v.costo_recuperado) },
        { concepto: 'Margen bruto', monto: redondear(margenBruto) },
        { concepto: 'Gastos operativos', monto: redondear(-v.gastos_operativos) },
        { concepto: 'Resultado', monto: redondear(margenBruto - v.gastos_operativos) },
      ],
      resumen: { margen_bruto_pct: ventasNetas > 0 ? Math.round((margenBruto / ventasNetas) * 1000) / 10 : null, lineas_sin_costo: v.lineas_sin_costo },
    };
  },
};

const catalogos: Herramienta<object> = {
  nombre: 'catalogos',
  descripcion: 'Nombres validos de sucursales y categorias, y desde y hasta que fecha hay datos de ventas. Usar si no se conoce un nombre o el rango disponible.',
  parametros: {},
  async ejecutar(_args, { idEmpresa, consultar }) {
    const [fila] = await consultar(
      `SELECT (SELECT array_agg(nombre ORDER BY nombre) FROM dw.dim_sucursal WHERE id_empresa = $1) AS sucursales,
              (SELECT array_agg(DISTINCT categoria) FROM dw.dim_producto WHERE id_empresa = $1 AND categoria IS NOT NULL) AS categorias,
              (SELECT MIN(f.fecha)::text FROM dw.fact_ventas v JOIN dw.dim_fecha f ON f.fecha_key = v.fecha_key WHERE v.id_empresa = $1) AS primera_venta,
              (SELECT MAX(f.fecha)::text FROM dw.fact_ventas v JOIN dw.dim_fecha f ON f.fecha_key = v.fecha_key WHERE v.id_empresa = $1) AS ultima_venta`,
      [idEmpresa],
    );
    return { filas: [fila] };
  },
};

export const HERRAMIENTAS_NEGOCIO = [clientesNuevos, ingresosYGastos, gastosPorTipo, resultado, catalogos];
