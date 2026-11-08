import { fechaKey, type CargaEtl } from './carga.js';

export const CARGA_FACT_COMPRAS: CargaEtl = {
  tabla: 'fact_compras',
  tipo: 'HECHO',
  sql: `
    INSERT INTO dw.fact_compras (id_detalle_compra, id_empresa, id_compra, nro_factura, fecha_key, id_sucursal, id_almacen, id_proveedor,
                                 id_variante, estado, cantidad, costo_unitario, importe)
    SELECT d.id, nc.id_empresa, nc.id, nc.nro_factura, ${fechaKey('nc.fecha_emision')}, nc.id_sucursal, d.id_almacen, nc.id_proveedor,
           d.id_variante_producto, nc.estado, d.cantidad, d.precio_unitario, d.subtotal
      FROM detalle_nota_compra d
      JOIN nota_compra nc ON nc.id = d.id_nota_compra
     WHERE nc.id_empresa = $1`,
};

/** El kardex tal cual; las transferencias se marcan para no contarlas como entradas o salidas de la empresa. */
export const CARGA_FACT_MOVIMIENTOS: CargaEtl = {
  tabla: 'fact_movimientos_inventario',
  tipo: 'HECHO',
  sql: `
    INSERT INTO dw.fact_movimientos_inventario (id_movimiento, id_empresa, fecha_key, hora, id_almacen, id_variante, tipo, cantidad,
                                                delta_reservado, costo_unitario, valor, referencia_tipo, referencia_id, es_transferencia)
    SELECT m.id, m.id_empresa, ${fechaKey('m.fecha_hora')}, m.fecha_hora::time, m.id_almacen, m.id_variante_producto, m.tipo, m.cantidad,
           m.delta_reservado, m.costo_unitario, m.cantidad * m.costo_unitario, m.referencia_tipo, m.referencia_id,
           m.tipo LIKE 'TRANSFERENCIA%'
      FROM movimiento_inventario m
     WHERE m.id_empresa = $1`,
};

/**
 * Stock al cierre de cada dia por almacen y variante, reconstruido sumando el kardex (cuya suma siempre es igual al
 * stock). Va desde el primer movimiento de cada fila hasta hoy, y guarda solo los dias con stock o con movimiento.
 * El valor usa el costo promedio actual de la variante (aproximacion: el kardex no guarda el costo promedio de cada
 * dia).
 */
export const CARGA_FACT_INVENTARIO_DIARIO: CargaEtl = {
  tabla: 'fact_inventario_diario',
  tipo: 'HECHO',
  sql: `
    INSERT INTO dw.fact_inventario_diario (id_empresa, fecha_key, id_almacen, id_variante, stock_disponible, stock_reservado, entradas,
                                           salidas, valor_costo)
    WITH mov AS (
      SELECT m.id_almacen, m.id_variante_producto AS id_variante, m.fecha_hora::date AS fecha,
             SUM(m.cantidad) AS delta_disponible, SUM(m.delta_reservado) AS delta_reservado,
             SUM(CASE WHEN m.cantidad > 0 AND m.tipo NOT LIKE 'TRANSFERENCIA%' THEN m.cantidad ELSE 0 END) AS entradas,
             SUM(CASE WHEN m.cantidad < 0 AND m.tipo NOT LIKE 'TRANSFERENCIA%' THEN -m.cantidad ELSE 0 END) AS salidas,
             COUNT(*) AS movimientos
        FROM movimiento_inventario m
       WHERE m.id_empresa = $1
       GROUP BY 1, 2, 3
    ),
    dias AS (
      SELECT r.id_almacen, r.id_variante, g::date AS fecha
        FROM (SELECT id_almacen, id_variante, MIN(fecha) AS desde FROM mov GROUP BY 1, 2) r
       CROSS JOIN LATERAL generate_series(r.desde, GREATEST(r.desde, CURRENT_DATE), interval '1 day') g
    ),
    acumulado AS (
      SELECT d.id_almacen, d.id_variante, d.fecha,
             SUM(COALESCE(mov.delta_disponible, 0)) OVER fila AS stock_disponible,
             SUM(COALESCE(mov.delta_reservado, 0)) OVER fila AS stock_reservado,
             COALESCE(mov.entradas, 0) AS entradas, COALESCE(mov.salidas, 0) AS salidas, COALESCE(mov.movimientos, 0) AS movimientos
        FROM dias d
        LEFT JOIN mov USING (id_almacen, id_variante, fecha)
      WINDOW fila AS (PARTITION BY d.id_almacen, d.id_variante ORDER BY d.fecha)
    )
    SELECT $1, ${fechaKey('a.fecha')}, a.id_almacen, a.id_variante, a.stock_disponible, a.stock_reservado, a.entradas, a.salidas,
           ROUND(a.stock_disponible * v.costo_promedio, 2)
      FROM acumulado a
      JOIN variante_producto v ON v.id = a.id_variante
     WHERE a.stock_disponible <> 0 OR a.stock_reservado <> 0 OR a.movimientos > 0`,
};
