import { fechaKey, type CargaEtl } from './carga.js';

/**
 * Lineas vendidas con las medidas de la nota ya repartidas (BI-METRICAS.md): cada linea recibe su parte del
 * descuento, el impuesto y el monto total segun su subtotal (partes iguales si todos los subtotales son 0), asi que
 * la suma de importe_neto por cualquier agrupacion da el total real de las notas.
 */
export const CARGA_FACT_VENTAS: CargaEtl = {
  tabla: 'fact_ventas',
  tipo: 'HECHO',
  sql: `
    INSERT INTO dw.fact_ventas (id_detalle_venta, id_empresa, id_nota, codigo_nota, fecha_key, hora, id_sucursal, id_cliente, id_variante,
                                id_cajero, canal, metodo_pago, cantidad, precio_lista, precio_unitario, descuento_producto, importe_bruto,
                                descuento_nota, impuesto_nota, importe_neto, costo_unitario, costo_total, margen)
    SELECT d.id, nv.id_empresa, nv.id, nv.codigo_nota, ${fechaKey('nv.fecha_emision')}, nv.hora_emision, nv.id_sucursal, nv.id_cliente,
           d.id_variante_producto, nv.id_cajero,
           CASE nv.tipo_venta WHEN 'E_COMMERCE' THEN 'ONLINE' WHEN 'PRESENCIAL_LIQUIDACION' THEN 'RESERVA' ELSE 'MOSTRADOR' END,
           pp.metodo, d.cantidad, d.precio_lista, d.precio_unitario, d.descuento_unitario * d.cantidad, d.subtotal,
           nv.descuento * d.peso, nv.impuesto * d.peso, nv.monto_total * d.peso,
           d.costo_unitario, d.costo_unitario * d.cantidad, nv.monto_total * d.peso - d.costo_unitario * d.cantidad
      FROM (SELECT dnv.*,
                   COALESCE(dnv.subtotal / NULLIF(SUM(dnv.subtotal) OVER nota, 0), 1.0 / COUNT(*) OVER nota) AS peso
              FROM detalle_nota_venta dnv
              JOIN nota_venta n ON n.id = dnv.id_nota_venta
             WHERE n.id_empresa = $1
            WINDOW nota AS (PARTITION BY dnv.id_nota_venta)) d
      JOIN nota_venta nv ON nv.id = d.id_nota_venta
      LEFT JOIN pasarela_de_pago pp ON pp.id = nv.id_pasarela`,
};

/**
 * Prendas devueltas (no los reembolsos de anticipo de reservas, que no tienen variante). Fecha y costo salen de la
 * linea vendida: el costo vuelve al inventario si la prenda se reingresa y se pierde si es merma.
 */
export const CARGA_FACT_DEVOLUCIONES: CargaEtl = {
  tabla: 'fact_devoluciones',
  tipo: 'HECHO',
  sql: `
    INSERT INTO dw.fact_devoluciones (id_detalle_devolucion, id_empresa, id_devolucion, codigo_devolucion, fecha_key, fecha_venta_key,
                                      id_detalle_venta, id_sucursal, id_cliente, id_variante, motivo, estado_producto, cantidad,
                                      monto_reembolsado, costo_unitario, costo_recuperado, costo_perdido)
    SELECT dd.id, nd.id_empresa, nd.id, nd.codigo_devolucion, ${fechaKey('nd.fecha_emision')}, ${fechaKey('nv.fecha_emision')},
           dd.id_detalle_nota_venta, nd.id_sucursal, nd.id_cliente, dd.id_variante_producto, nd.motivo_devolucion::text,
           dd.estado_producto::text, dd.cantidad, dd.monto_subtotal, dnv.costo_unitario,
           CASE WHEN dd.estado_producto = 'REINGRESO_INVENTARIO' THEN dd.cantidad * dnv.costo_unitario ELSE 0 END,
           CASE WHEN dd.estado_producto = 'MERMA_DEFECTUOSO' THEN dd.cantidad * dnv.costo_unitario ELSE 0 END
      FROM detalle_nota_devolucion dd
      JOIN nota_devolucion nd ON nd.id = dd.id_nota_devolucion
      LEFT JOIN detalle_nota_venta dnv ON dnv.id = dd.id_detalle_nota_venta
      LEFT JOIN nota_venta nv ON nv.id = dnv.id_nota_venta
     WHERE nd.id_empresa = $1 AND dd.id_variante_producto IS NOT NULL`,
};
