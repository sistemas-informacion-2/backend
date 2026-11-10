# Métricas del BI

Definiciones únicas para el Data Warehouse, los dashboards y el agente de IA. Si una cifra se calcula en más de un lugar, se calcula como dice aquí. Todas las consultas filtran por `id_empresa`, y las fechas están en hora de La Paz (`America/La_Paz`).

## Cómo se registra una venta

| Flujo | `nota_venta.tipo_venta` | Pagos (`pago.concepto`) |
|---|---|---|
| Venta en mostrador | `DIRECTA_PRESENCIAL` | `PAGO_TOTAL` |
| Compra en la tienda en línea | `E_COMMERCE` | `PAGO_TOTAL` (no pasa por caja) |
| Reserva: anticipo | *no crea nota* | `ANTICIPO_RESERVA` (con `id_reserva`) |
| Reserva: retiro y saldo | `PRESENCIAL_LIQUIDACION`, con `monto_anticipo_aplicado` | `SALDO_LIQUIDACION` |
| Devolución | *nota_devolucion* | `REEMBOLSO` |

- `monto_total = subtotal − descuento + impuesto`. El subtotal es la suma de `detalle_nota_venta.subtotal`.
- La nota que liquida una reserva lleva el **total completo** de la venta. El anticipo ya cobrado figura en `monto_anticipo_aplicado` y como un `pago` aparte.
- `estado_pago` siempre vale `'Pagado'`: no sirve para segmentar.

## Ventas

**Ventas brutas** = `SUM(nota_venta.monto_total)`.
- A nivel de línea (por producto, categoría, talla o color), cada línea recibe su parte de la cabecera según su subtotal:
  `importe_linea = dnv.subtotal / SUM(dnv.subtotal) OVER (PARTITION BY nota) × nv.monto_total`.
  Si todos los subtotales de la nota valen 0, se reparte en partes iguales. Las partes de una nota suman exactamente su `monto_total`. El Constructor de reportes ya aplica este mismo reparto (`deCabecera` y `prorrateo` en `reporte-catalog.constants.ts`).
- **Nunca** se suma `nv.monto_total` en una consulta unida a `detalle_nota_venta` sin repartir: cada nota se contaría una vez por línea.

**Unidades vendidas** = `SUM(detalle_nota_venta.cantidad)`.

**Devoluciones** = `SUM(detalle_nota_devolucion.monto_subtotal)` de las líneas con `id_detalle_nota_venta` no nulo.
- El `precio_unitario` de la línea devuelta ya incluye el descuento y el impuesto de la nota, porque así se calcula el reembolso.
- La línea devuelta apunta a su línea de venta con `id_detalle_nota_venta`. Si la nota tenía la misma variante en varias líneas, apunta a la primera.
- Un reembolso de anticipo de reserva tiene `id_variante_producto` y `id_detalle_nota_venta` nulos: **no** es una devolución de venta.
- La fecha de la devolución es `nota_devolucion.fecha_emision`, no la fecha de la venta.

**Ventas netas** = ventas brutas − devoluciones. Para atribuir una devolución a la fecha de su venta (cohortes), se une por `id_detalle_nota_venta`.

**Tickets (número de ventas)** = `COUNT(DISTINCT nota_venta.id)`.
**Ticket promedio** = ventas brutas / tickets.

## Costo y margen

**Costo de ventas** = `SUM(dnv.cantidad × dnv.costo_unitario)`.
- `costo_unitario` es el costo promedio ponderado de la variante en el momento de la venta. Puede ser nulo (ventas anteriores al costeo, o una variante que nunca se compró). Esas líneas **se excluyen** del margen, y el resultado indica cuántas quedaron fuera.

**Costo recuperado por devoluciones** = `cantidad × costo_unitario` de su línea de venta, solo para las líneas con `estado_producto = 'REINGRESO_INVENTARIO'`. Las de `MERMA_DEFECTUOSO` no recuperan costo: son pérdida.

**Margen bruto** = ventas netas − (costo de ventas − costo recuperado).
**% de margen** = margen bruto / ventas netas.

**Merma** = `SUM(cantidad × costo_unitario)` de las líneas devueltas como `MERMA_DEFECTUOSO`, más los movimientos `AJUSTE_SALIDA` del kardex (`movimiento_inventario`), valuados a su `costo_unitario`.

**Descuento otorgado** = descuento por producto `SUM(dnv.descuento_unitario × dnv.cantidad)` + descuento de cabecera `SUM(nv.descuento)`. El precio de lista está en `dnv.precio_lista`.

## Dinero: ingresos y gastos

**Ingresos cobrados** = `SUM(pago.monto)` con concepto `PAGO_TOTAL`, `ANTICIPO_RESERVA` o `SALDO_LIQUIDACION`, menos los `REEMBOLSO`.
- Salen de `pago`, **no** de la caja: las compras en línea no pasan por caja.
- **No se suma el anticipo dos veces**: ventas (devengado) e ingresos (cobrado) son métricas distintas. La venta liquidada ya incluye el total, y el anticipo ya está como pago. Una reserva cancelada cuyo anticipo no se devolvió es ingreso sin venta.

**Gastos operativos** = `SUM(movimiento_caja.monto)` con `categoria = 'GASTO_OPERATIVO'`, desglosados por `subcategoria_gasto` (alquiler, sueldos, servicios, etc.). `RETIRO` y `APORTE` son movimientos del dueño y **no** son gasto ni ingreso. Las compras a proveedores (`COMPRA`) son inventario, no gasto: llegan al resultado como costo de ventas.

**Compras** = `SUM(nota_compra.total)`. Por producto se usa `detalle_nota_compra.subtotal`, o se reparte la cabecera como en las ventas.

## Inventario

**Stock** = `inventario.stock_disponible` (vendible) e `inventario.stock_reservado` (apartado), por almacén y variante.
- El historial está en el kardex `movimiento_inventario`. Siempre se cumple `SUM(cantidad) = stock_disponible` y `SUM(delta_reservado) = stock_reservado`, así que el stock de cualquier fecha pasada es la suma de los movimientos hasta esa fecha.
- Las transferencias entre almacenes (`TRANSFERENCIA_SALIDA` y `TRANSFERENCIA_ENTRADA`) no cambian el stock de la empresa: se excluyen al medir entradas y salidas totales.

**Valor del inventario** = `stock_disponible × variante_producto.costo_promedio` (a costo). A precio de venta se multiplica por `producto.precio`, pero esa cifra se informa por separado.

**Rotación** (en un período) = costo de ventas / valor de inventario promedio.
**Días de inventario** = valor de inventario / (costo de ventas / días del período).

**Stock crítico** = `stock_disponible <= stock_minimo`.

## Clientes

- Se **excluye** siempre al cliente genérico de mostrador: `cliente.es_consumidor_final = true`. Sus ventas cuentan en los totales, pero no en recurrencia, ticket por cliente ni "mejores clientes".
- **Cliente nuevo** en un período = su primera nota de venta cae en ese período (no su `usuario.fecha_creacion`).
- **Recurrencia** = clientes con 2 o más notas en el período / clientes con al menos 1.
- En el Constructor de reportes, el campo `cliente_identificado` separa las ventas a clientes identificados del consumidor final.
