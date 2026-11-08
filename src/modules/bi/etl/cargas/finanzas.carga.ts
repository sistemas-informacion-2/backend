import { fechaKey, type CargaEtl } from './carga.js';

/**
 * Pagos (ingresos cobrados, BI-METRICAS.md): presenciales si pasaron por caja, en linea si no. La sucursal sale de la
 * caja, de la nota o de la reserva. Los reembolsos cuentan en negativo en monto_neto.
 */
export const CARGA_FACT_PAGOS: CargaEtl = {
  tabla: 'fact_pagos',
  tipo: 'HECHO',
  sql: `
    INSERT INTO dw.fact_pagos (id_pago, id_empresa, fecha_key, hora, id_sucursal, concepto, metodo, canal, monto, monto_neto, id_nota_venta,
                               id_reserva)
    SELECT p.id, p.id_empresa, ${fechaKey('p.fecha_pago')}, p.hora_pago, COALESCE(c.id_sucursal, nv.id_sucursal, r.id_sucursal),
           p.concepto::text, pp.metodo, CASE WHEN p.id_movimiento_caja IS NULL THEN 'ONLINE' ELSE 'PRESENCIAL' END,
           p.monto, CASE WHEN p.concepto = 'REEMBOLSO' THEN -p.monto ELSE p.monto END, p.id_nota_venta, p.id_reserva
      FROM pago p
      LEFT JOIN movimiento_caja mc ON mc.id = p.id_movimiento_caja
      LEFT JOIN caja c ON c.id = mc.id_caja
      LEFT JOIN nota_venta nv ON nv.id = p.id_nota_venta
      LEFT JOIN reserva r ON r.id = p.id_reserva
      LEFT JOIN pasarela_de_pago pp ON pp.id = p.id_pasarela
     WHERE p.id_empresa = $1`,
};

/** Egresos manuales de caja: gastos operativos (con su tipo), otros egresos y retiros del dueno. */
export const CARGA_FACT_GASTOS: CargaEtl = {
  tabla: 'fact_gastos',
  tipo: 'HECHO',
  sql: `
    INSERT INTO dw.fact_gastos (id_movimiento_caja, id_empresa, fecha_key, hora, id_sucursal, categoria, subcategoria, concepto, monto)
    SELECT mc.id, c.id_empresa, ${fechaKey('mc.fecha_hora')}, mc.fecha_hora::time, c.id_sucursal, mc.categoria, mc.subcategoria_gasto,
           mc.concepto, mc.monto
      FROM movimiento_caja mc
      JOIN caja c ON c.id = mc.id_caja
     WHERE c.id_empresa = $1 AND mc.tipo = 'EGRESO' AND mc.categoria IN ('GASTO_OPERATIVO', 'OTRO_EGRESO', 'RETIRO')`,
};

/**
 * Reservas con su desenlace: la nota de liquidacion si se retiraron, o la liberacion del stock apartado si se
 * cancelaron o vencieron. Las que siguen activas no tienen desenlace.
 */
export const CARGA_FACT_RESERVAS: CargaEtl = {
  tabla: 'fact_reservas',
  tipo: 'HECHO',
  sql: `
    INSERT INTO dw.fact_reservas (id_reserva, id_empresa, codigo_reserva, fecha_key, fecha_desenlace_key, id_sucursal, id_cliente, estado,
                                  monto_total, monto_anticipo, anticipo_pagado, horas_hasta_desenlace, id_nota_venta)
    SELECT r.id, r.id_empresa, r.codigo_reserva, ${fechaKey('r.fecha_reserva')}, ${fechaKey('des.momento')}, r.id_sucursal, r.id_cliente,
           r.estado::text, r.monto_total, r.monto_anticipo, COALESCE(ant.pagado, 0),
           ROUND((EXTRACT(EPOCH FROM des.momento - r.fecha_reserva) / 3600)::numeric, 2), nv.id
      FROM reserva r
      LEFT JOIN nota_venta nv ON nv.id_reserva = r.id
      LEFT JOIN LATERAL (
        SELECT MIN(m.fecha_hora) AS momento
          FROM movimiento_inventario m
         WHERE m.referencia_tipo = 'RESERVA' AND m.referencia_id = r.id AND m.tipo = 'LIBERACION_RESERVA'
      ) lib ON TRUE
      CROSS JOIN LATERAL (
        SELECT CASE WHEN nv.id IS NOT NULL THEN nv.fecha_emision + nv.hora_emision WHEN r.estado = 'CANCELADA' THEN lib.momento END AS momento
      ) des
      LEFT JOIN LATERAL (
        SELECT SUM(p.monto) AS pagado FROM pago p WHERE p.id_reserva = r.id AND p.concepto = 'ANTICIPO_RESERVA'
      ) ant ON TRUE
     WHERE r.id_empresa = $1`,
};
