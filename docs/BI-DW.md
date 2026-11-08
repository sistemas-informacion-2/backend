# Data Warehouse (esquema `dw`)

El DW del BI vive en el esquema `dw` de la misma base `ecommerce`, separado de las tablas de la app (`public`). Lo crea la migración `DataWarehouse1794169589484` y lo llena el ETL del módulo `bi` (fase 2 de [PLAN-BI.md](../../PLAN-BI.md)). Las métricas se calculan como dice [BI-METRICAS.md](BI-METRICAS.md).

## Modelo en estrella

```
                         dim_fecha
                             │
 dim_producto ── fact_ventas / fact_devoluciones / fact_compras ── dim_cliente
                             │                                     dim_proveedor
                  dim_sucursal ── dim_almacen ── fact_inventario_diario
                                                 fact_movimientos_inventario
                  fact_pagos · fact_gastos · fact_reservas
```

- **Claves:**
  - las dimensiones usan el **id de origen** (`id_variante`, `id_cliente`, `id_sucursal`…), que ya es único en toda la base;
  - las fechas usan `fecha_key` = AAAAMMDD;
  - todas las tablas llevan `id_empresa`, salvo `dim_fecha`.
- **Granularidad:**
  - `fact_ventas`: línea vendida;
  - `fact_devoluciones`: línea devuelta (solo prendas, no reembolsos de anticipo);
  - `fact_compras`: línea comprada;
  - `fact_inventario_diario`: almacén × variante × día;
  - `fact_movimientos_inventario`: movimiento del kardex;
  - `fact_pagos`: pago;
  - `fact_gastos`: egreso manual de caja;
  - `fact_reservas`: reserva.
- **Medidas ya preparadas:** el descuento y el impuesto de la nota vienen repartidos por línea (`descuento_nota`, `impuesto_nota`, `importe_neto`), y el margen ya está calculado. Sumar `importe_neto` por cualquier dimensión da el total real.
- **Historia de las dimensiones:** se pisan (tipo 1). Los precios y costos históricos viven en los hechos, así que cambiar el precio de un producto no altera las ventas pasadas.

## Calendario (`dim_fecha`)

Del 2020-01-01 al 2032-12-31. Cada día tiene:
- día de la semana ISO (1 = lunes) y semana ISO;
- mes, trimestre y año;
- temporada del hemisferio sur, con las mismas fronteras que las temporadas de la tienda;
- feriados nacionales de Bolivia, incluidos los móviles: Carnaval, Viernes Santo y Corpus Christi.

Lo genera `src/database/dw/calendario.ts`.

## Control del ETL

`dw.etl_ejecucion`: una fila por carga, con empresa, origen (`PROGRAMADO` o `MANUAL`), estado, inicio y fin, filas por tabla, error y usuario que la pidió.

## Rol de solo lectura

La migración crea el rol **`bi_lector`** (sin login), con `SELECT` sobre todo `dw`, incluidas las tablas futuras. Los servicios que solo leen el DW (como el de machine learning) se conectan con un usuario que pertenece a ese rol.

Para crear ese usuario (una vez, como administrador de la base):

```sql
CREATE ROLE bi_ml LOGIN PASSWORD '<una contraseña segura>' IN ROLE bi_lector;
```

La contraseña va en el `.env` del servicio, nunca en el repositorio.

Si el usuario de la base no puede crear roles (algunos Postgres administrados no lo permiten), la migración lo avisa y sigue. En ese caso hay que correr como administrador:

```sql
CREATE ROLE bi_lector NOLOGIN;
GRANT USAGE ON SCHEMA dw TO bi_lector;
GRANT SELECT ON ALL TABLES IN SCHEMA dw TO bi_lector;
ALTER DEFAULT PRIVILEGES IN SCHEMA dw GRANT SELECT ON TABLES TO bi_lector;
```
