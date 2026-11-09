import { CATEGORIA, Consulta, DESDE, expresion, HASTA, LIMITE, SUCURSAL, validarRango, visualAgrupado, type Herramienta } from './herramienta.js';

const GRUPOS_STOCK: Record<string, string> = {
  total: "'Total'",
  sucursal: 's.nombre',
  almacen: 'a.nombre',
  categoria: "COALESCE(p.categoria, 'Sin categoria')",
  producto: 'p.producto',
};

const stockEnFecha: Herramienta<{ fecha: string; agrupar_por?: string; sucursal?: string; categoria?: string; limite?: number }> = {
  nombre: 'stock_en_fecha',
  visual: (a) => visualAgrupado('Stock', a.agrupar_por, ['stock_disponible']),
  descripcion: 'Stock disponible, reservado y valor a costo al cierre de una fecha (pasada o de hoy), en total o por sucursal, almacen, categoria o producto.',
  parametros: {
    fecha: { tipo: 'string', fecha: true, descripcion: 'Fecha, AAAA-MM-DD' },
    agrupar_por: { tipo: 'string', descripcion: 'Por defecto total', enum: Object.keys(GRUPOS_STOCK) },
    sucursal: SUCURSAL,
    categoria: CATEGORIA,
    limite: LIMITE,
  },
  requeridos: ['fecha'],
  async ejecutar(args, { idEmpresa, consultar }) {
    const q = new Consulta(idEmpresa);
    const grupo = expresion(GRUPOS_STOCK, args.agrupar_por ?? 'total');
    const fecha = q.fecha(args.fecha);
    const filtros = [args.sucursal ? q.contiene('s.nombre', args.sucursal) : null, args.categoria ? q.contiene('p.categoria', args.categoria) : null].filter(Boolean);
    const limite = q.entero(args.limite ?? 50);
    const filas = await consultar(
      `WITH ultimo AS (
         SELECT DISTINCT ON (i.id_almacen, i.id_variante) i.id_almacen, i.id_variante, i.stock_disponible, i.stock_reservado, i.valor_costo
           FROM dw.fact_inventario_diario i
          WHERE i.id_empresa = $1 AND i.fecha_key <= to_char(${fecha}, 'YYYYMMDD')::int
          ORDER BY i.id_almacen, i.id_variante, i.fecha_key DESC)
       SELECT ${grupo} AS grupo, SUM(u.stock_disponible)::int AS stock_disponible, SUM(u.stock_reservado)::int AS stock_reservado, ROUND(SUM(u.valor_costo), 2)::float8 AS valor_costo
         FROM ultimo u
         JOIN dw.dim_almacen a ON a.id_almacen = u.id_almacen
         JOIN dw.dim_sucursal s ON s.id_sucursal = a.id_sucursal
         JOIN dw.dim_producto p ON p.id_variante = u.id_variante
        ${filtros.length ? `WHERE ${filtros.join(' AND ')}` : ''}
        GROUP BY 1 ORDER BY stock_disponible DESC LIMIT ${limite}`,
      q.parametros,
    );
    return { filas, nota: 'valor_costo usa el costo promedio actual de cada variante, tambien para fechas pasadas.' };
  },
};

const GRUPOS_ROTACION: Record<string, { ventas: string; inventario: string }> = {
  total: { ventas: "'Total'", inventario: "'Total'" },
  categoria: { ventas: "COALESCE(p.categoria, 'Sin categoria')", inventario: "COALESCE(p.categoria, 'Sin categoria')" },
  sucursal: { ventas: 's.nombre', inventario: 's.nombre' },
};

const rotacion: Herramienta<{ desde: string; hasta: string; agrupar_por?: string }> = {
  nombre: 'rotacion_y_dias_inventario',
  visual: (a) => visualAgrupado('Rotacion', a.agrupar_por, ['rotacion']),
  descripcion: 'Rotacion del inventario (costo de ventas / inventario promedio) y dias de inventario de un periodo.',
  parametros: { desde: DESDE, hasta: HASTA, agrupar_por: { tipo: 'string', descripcion: 'Por defecto total', enum: Object.keys(GRUPOS_ROTACION) } },
  requeridos: ['desde', 'hasta'],
  async ejecutar(args, { idEmpresa, consultar }) {
    validarRango(args.desde, args.hasta);
    const grupos = GRUPOS_ROTACION[args.agrupar_por ?? 'total'];
    const q = new Consulta(idEmpresa);
    const [desde, hasta] = [q.fecha(args.desde), q.fecha(args.hasta)];
    const dias = `(${hasta} - ${desde} + 1)`;
    const filas = await consultar(
      `WITH costo AS (
         SELECT ${grupos.ventas} AS grupo, SUM(v.costo_total) AS costo
           FROM dw.fact_ventas v JOIN dw.dim_fecha f ON f.fecha_key = v.fecha_key
           LEFT JOIN dw.dim_sucursal s ON s.id_sucursal = v.id_sucursal LEFT JOIN dw.dim_producto p ON p.id_variante = v.id_variante
          WHERE v.id_empresa = $1 AND f.fecha BETWEEN ${desde} AND ${hasta} GROUP BY 1),
       inventario AS (
         SELECT ${grupos.inventario} AS grupo, SUM(i.valor_costo) / ${dias} AS promedio
           FROM dw.fact_inventario_diario i JOIN dw.dim_fecha f ON f.fecha_key = i.fecha_key
           JOIN dw.dim_almacen a ON a.id_almacen = i.id_almacen JOIN dw.dim_sucursal s ON s.id_sucursal = a.id_sucursal
           JOIN dw.dim_producto p ON p.id_variante = i.id_variante
          WHERE i.id_empresa = $1 AND f.fecha BETWEEN ${desde} AND ${hasta} GROUP BY 1)
       SELECT i.grupo, ROUND(COALESCE(c.costo, 0), 2)::float8 AS costo_ventas, ROUND(i.promedio, 2)::float8 AS inventario_promedio,
              ROUND(COALESCE(c.costo, 0) / NULLIF(i.promedio, 0), 2)::float8 AS rotacion,
              ROUND(i.promedio / NULLIF(COALESCE(c.costo, 0) / ${dias}, 0), 1)::float8 AS dias_inventario
         FROM inventario i LEFT JOIN costo c ON c.grupo = i.grupo ORDER BY rotacion DESC NULLS LAST`,
      q.parametros,
    );
    return { filas };
  },
};

const quiebres: Herramienta<{ desde: string; hasta: string; sucursal?: string; categoria?: string; limite?: number }> = {
  nombre: 'quiebres_de_stock',
  visual: () => ({ titulo: 'Quiebres de stock', tipo: 'tabla' }),
  descripcion: 'Variantes que se quedaron sin stock disponible en un periodo y cuantos dias estuvieron asi.',
  parametros: { desde: DESDE, hasta: HASTA, sucursal: SUCURSAL, categoria: CATEGORIA, limite: LIMITE },
  requeridos: ['desde', 'hasta'],
  async ejecutar(args, { idEmpresa, consultar }) {
    validarRango(args.desde, args.hasta);
    const q = new Consulta(idEmpresa);
    const [desde, hasta] = [q.fecha(args.desde), q.fecha(args.hasta)];
    const filtros = [args.sucursal ? q.contiene('s.nombre', args.sucursal) : null, args.categoria ? q.contiene('p.categoria', args.categoria) : null].filter(Boolean);
    const limite = q.entero(args.limite ?? 20);
    const filas = await consultar(
      `WITH serie AS (
         SELECT i.id_almacen, i.id_variante, d.fecha, i.stock_disponible,
                LEAD(d.fecha) OVER (PARTITION BY i.id_almacen, i.id_variante ORDER BY d.fecha) AS siguiente
           FROM dw.fact_inventario_diario i JOIN dw.dim_fecha d ON d.fecha_key = i.fecha_key
          WHERE i.id_empresa = $1 AND d.fecha <= ${hasta})
       SELECT p.producto, p.sku, p.talla, p.color, s.nombre AS sucursal, a.nombre AS almacen,
              SUM(LEAST(COALESCE(x.siguiente, ${hasta} + 1), ${hasta} + 1) - GREATEST(x.fecha, ${desde}))::int AS dias_sin_stock
         FROM serie x
         JOIN dw.dim_almacen a ON a.id_almacen = x.id_almacen JOIN dw.dim_sucursal s ON s.id_sucursal = a.id_sucursal
         JOIN dw.dim_producto p ON p.id_variante = x.id_variante
        WHERE x.stock_disponible = 0 AND COALESCE(x.siguiente, ${hasta} + 1) > ${desde}
              ${filtros.length ? `AND ${filtros.join(' AND ')}` : ''}
        GROUP BY p.producto, p.sku, p.talla, p.color, s.nombre, a.nombre
        ORDER BY dias_sin_stock DESC LIMIT ${limite}`,
      q.parametros,
    );
    return { filas };
  },
};

const GRUPOS_MERMA: Record<string, string> = { total: "'Total'", mes: "to_char(x.fecha, 'YYYY-MM')", categoria: "COALESCE(p.categoria, 'Sin categoria')", producto: 'p.producto', origen: 'x.origen' };

const merma: Herramienta<{ desde: string; hasta: string; agrupar_por?: string; limite?: number }> = {
  nombre: 'merma',
  visual: (a) => visualAgrupado('Merma', a.agrupar_por, ['costo']),
  descripcion: 'Unidades y costo perdidos: prendas devueltas defectuosas y salidas por ajuste de inventario.',
  parametros: { desde: DESDE, hasta: HASTA, agrupar_por: { tipo: 'string', descripcion: 'Por defecto total', enum: Object.keys(GRUPOS_MERMA) }, limite: LIMITE },
  requeridos: ['desde', 'hasta'],
  async ejecutar(args, { idEmpresa, consultar }) {
    validarRango(args.desde, args.hasta);
    const q = new Consulta(idEmpresa);
    const grupo = expresion(GRUPOS_MERMA, args.agrupar_por ?? 'total');
    const [desde, hasta] = [q.fecha(args.desde), q.fecha(args.hasta)];
    const limite = q.entero(args.limite ?? 30);
    const filas = await consultar(
      `WITH perdida AS (
         SELECT f.fecha, d.id_variante, d.cantidad, d.costo_perdido AS costo, 'DEVOLUCION' AS origen
           FROM dw.fact_devoluciones d JOIN dw.dim_fecha f ON f.fecha_key = d.fecha_key
          WHERE d.id_empresa = $1 AND d.estado_producto = 'MERMA_DEFECTUOSO' AND f.fecha BETWEEN ${desde} AND ${hasta}
         UNION ALL
         SELECT f.fecha, m.id_variante, ABS(m.cantidad), ABS(m.cantidad) * COALESCE(m.costo_unitario, pr.costo_promedio_actual), 'AJUSTE'
           FROM dw.fact_movimientos_inventario m JOIN dw.dim_fecha f ON f.fecha_key = m.fecha_key JOIN dw.dim_producto pr ON pr.id_variante = m.id_variante
          WHERE m.id_empresa = $1 AND m.tipo = 'AJUSTE_SALIDA' AND f.fecha BETWEEN ${desde} AND ${hasta})
       SELECT ${grupo} AS grupo, SUM(x.cantidad)::int AS unidades, ROUND(COALESCE(SUM(x.costo), 0), 2)::float8 AS costo
         FROM perdida x JOIN dw.dim_producto p ON p.id_variante = x.id_variante
        GROUP BY 1 ORDER BY ${args.agrupar_por === 'mes' ? '1' : 'costo DESC'} LIMIT ${limite}`,
      q.parametros,
    );
    return { filas };
  },
};

const candidatosALiquidar: Herramienta<{ sucursal?: string; categoria?: string; dias_cobertura_minimos?: number; limite?: number }> = {
  nombre: 'candidatos_a_liquidar',
  visual: () => ({ titulo: 'Candidatos a liquidar', tipo: 'tabla' }),
  descripcion: 'Variantes con mucho stock para lo poco que se vende (ultimos 90 dias): candidatas a descuento o transferencia. Hechas con reglas sobre datos, no con un modelo.',
  parametros: {
    sucursal: SUCURSAL,
    categoria: CATEGORIA,
    dias_cobertura_minimos: { tipo: 'integer', descripcion: 'Dias de venta que cubre el stock; por defecto 120', minimo: 30, maximo: 720 },
    limite: LIMITE,
  },
  async ejecutar(args, { idEmpresa, consultar, hoy }) {
    const q = new Consulta(idEmpresa);
    const fechaHoy = q.fecha(hoy);
    const minimo = q.entero(args.dias_cobertura_minimos ?? 120);
    const filtros = [args.sucursal ? q.contiene('s.nombre', args.sucursal) : null, args.categoria ? q.contiene('p.categoria', args.categoria) : null].filter(Boolean);
    const limite = q.entero(args.limite ?? 20);
    const filas = await consultar(
      `WITH ultimo AS (
         SELECT DISTINCT ON (i.id_almacen, i.id_variante) i.id_almacen, i.id_variante, i.stock_disponible
           FROM dw.fact_inventario_diario i WHERE i.id_empresa = $1 ORDER BY i.id_almacen, i.id_variante, i.fecha_key DESC),
       stock AS (
         SELECT a.id_sucursal, u.id_variante, SUM(u.stock_disponible) AS stock
           FROM ultimo u JOIN dw.dim_almacen a ON a.id_almacen = u.id_almacen GROUP BY 1, 2),
       vendidas AS (
         SELECT v.id_sucursal, v.id_variante, SUM(v.cantidad) AS unidades
           FROM dw.fact_ventas v JOIN dw.dim_fecha f ON f.fecha_key = v.fecha_key
          WHERE v.id_empresa = $1 AND f.fecha > ${fechaHoy} - 90 GROUP BY 1, 2)
       SELECT p.producto, p.sku, p.talla, p.color, s.nombre AS sucursal, x.stock::int AS stock, COALESCE(y.unidades, 0)::int AS vendidas_90_dias,
              ROUND(x.stock * 90.0 / NULLIF(y.unidades, 0))::int AS dias_cobertura, ROUND(x.stock * p.costo_promedio_actual, 2)::float8 AS valor_inmovilizado
         FROM stock x
         JOIN dw.dim_producto p ON p.id_variante = x.id_variante AND p.activo
         JOIN dw.dim_sucursal s ON s.id_sucursal = x.id_sucursal
         LEFT JOIN vendidas y ON y.id_sucursal = x.id_sucursal AND y.id_variante = x.id_variante
        WHERE x.stock >= 5 AND (y.unidades IS NULL OR x.stock * 90.0 / y.unidades >= ${minimo})
              ${filtros.length ? `AND ${filtros.join(' AND ')}` : ''}
        ORDER BY valor_inmovilizado DESC NULLS LAST LIMIT ${limite}`,
      q.parametros,
    );
    return {
      filas,
      nota: 'dias_cobertura vacio significa que no se vendio ninguna unidad en 90 dias. Esta lista no considera la temporada: una prenda de invierno vende poco en verano y puede convenir guardarla para el proximo invierno en lugar de rematarla; aclaralo si aplica.',
    };
  },
};

export const HERRAMIENTAS_INVENTARIO = [stockEnFecha, rotacion, quiebres, merma, candidatosALiquidar];
