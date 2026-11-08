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

## ETL (`modules/bi/etl`)

**Cómo se ejecuta:**
- **Una empresa a la vez, en una sola transacción.** Si algo falla, el DW de esa empresa queda como estaba.
- **Dimensiones:** `INSERT … ON CONFLICT DO UPDATE` (nunca se borran).
- **Hechos:** se borran las filas de la empresa y se recargan enteras con `INSERT … SELECT`. El SQL de cada tabla está en `etl/cargas/*.carga.ts`.
- **Sin cargas cruzadas:** un bloqueo de Postgres (`pg_try_advisory_xact_lock`) impide dos cargas a la vez de la misma empresa. La segunda recibe 409.

**Cuándo corre:**
- **Cada noche:** `BI_ETL_CRON`, por defecto `0 2 * * *`, hora de La Paz. Carga todas las empresas activas, y si una falla siguen las demás. `BI_ETL_PROGRAMADO=false` la apaga.
- **A pedido:** `POST /bi/etl/ejecutar` (permiso `analitica:bi:etl`).
- **Historial:** `GET /bi/etl/historial` (permiso `analitica:bi:usar`) muestra las últimas cargas.

**Al terminar** avisa al servicio de machine learning (`ML_URL` + `ML_CLAVE_INTERNA`) para que vuelva a entrenar. Si no está configurado, no hace nada. Si el aviso falla, la carga igual queda hecha.

**Reglas de cada tabla** (siguen [BI-METRICAS.md](BI-METRICAS.md)):
- **`fact_ventas`:**
  - el canal sale del tipo de venta: `DIRECTA_PRESENCIAL` → MOSTRADOR, `E_COMMERCE` → ONLINE, `PRESENCIAL_LIQUIDACION` → RESERVA;
  - descuento, impuesto y monto de la nota se reparten según el subtotal de cada línea;
  - `margen = importe_neto − costo_total`, nulo si la línea no tiene costo.
- **`fact_devoluciones`:**
  - solo prendas, no los reembolsos de anticipo;
  - la fecha y el costo salen de la línea vendida;
  - el costo es recuperado si la prenda vuelve al stock y perdido si es merma.
- **`fact_inventario_diario`:**
  - es la suma acumulada del kardex por día, desde el primer movimiento de cada fila hasta hoy;
  - solo guarda los días con stock o con movimiento;
  - las transferencias no cuentan como entradas ni salidas;
  - `valor_costo` usa el **costo promedio actual** de la variante: es una aproximación, porque el kardex no guarda el promedio de cada día.
- **`fact_pagos`:** el canal es PRESENCIAL si el pago pasó por caja y ONLINE si no. Los reembolsos van en negativo en `monto_neto`.
- **`fact_gastos`:** los egresos manuales de caja: `GASTO_OPERATIVO`, `OTRO_EGRESO` y `RETIRO`.
- **`fact_reservas`:**
  - el desenlace es la nota de liquidación o la liberación del stock (cancelada o vencida);
  - las reservas activas no tienen desenlace.

**Conciliación:** se probó con la historia de demostración. El DW coincide con el origen al centavo en:
- ventas, costo, margen y descuentos;
- devoluciones, compras y kardex;
- el stock del último día de cada fila;
- pagos por concepto, gastos por tipo y reservas por estado.

Además, ningún hecho apunta a dimensiones de otra empresa.

## Control del ETL

`dw.etl_ejecucion`: una fila por carga, con empresa, origen (`PROGRAMADO` o `MANUAL`), estado, inicio y fin, filas por tabla, error y usuario que la pidió.

## Resultados de los modelos (`dw.ml_*`)

Los escribe el servicio `ml/` (Python) después de cada carga, por empresa. Cada modelo reemplaza sus filas en una transacción.

| Tabla | Contenido |
|---|---|
| `ml_ejecucion` | Una fila por entrenamiento: estado (`OK`, `PARCIAL`, `ERROR`) y métricas de cada modelo |
| `ml_pronostico` | Ventas futuras por período (total, sucursal o categoría; semanal o mensual), con intervalo del 80 % y el modelo elegido |
| `ml_sugerencia_compra` | Variante y sucursal: demanda esperada a 2 meses, stock, stock de seguridad y cantidad sugerida |
| `ml_riesgo_abandono` | Cliente: probabilidad de no comprar en 90 días, nivel y principales factores |
| `ml_segmento_cliente` | Cliente: segmento, recencia, frecuencia y monto |
| `ml_asociacion` | Productos que se compran juntos: soporte, confianza y lift |
| `ml_anomalia` | Días atípicos por sucursal, medidos en tickets presenciales: valor real, esperado y desviación |

## Rol de solo lectura

La migración crea el rol **`bi_lector`** (sin login), con `SELECT` sobre todo `dw`, incluidas las tablas futuras. Los servicios que solo leen el DW (como el de machine learning) se conectan con un usuario que pertenece a ese rol.

El rol **`bi_entrenador`** (sin login) hereda esa lectura y además puede escribir, solo, en las tablas `dw.ml_*`. Lo usa el servicio de machine learning.

Para crear su usuario (una vez, como administrador de la base):

```sql
CREATE ROLE bi_ml LOGIN PASSWORD '<una contraseña segura>' IN ROLE bi_entrenador;
```

La contraseña va en el `.env` del servicio, nunca en el repositorio.

Si el usuario de la base no puede crear roles (algunos Postgres administrados no lo permiten), la migración lo avisa y sigue. En ese caso hay que correr como administrador:

```sql
CREATE ROLE bi_lector NOLOGIN;
GRANT USAGE ON SCHEMA dw TO bi_lector;
GRANT SELECT ON ALL TABLES IN SCHEMA dw TO bi_lector;
ALTER DEFAULT PRIVILEGES IN SCHEMA dw GRANT SELECT ON TABLES TO bi_lector;
```
