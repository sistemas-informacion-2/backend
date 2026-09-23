# Especificación Detallada de Funcionalidades - Ciclo #3

---

## CU12 – Gestionar Ventas Presenciales

**Actores:** Vendedor/Cajero (VC), Encargado de Sucursal (ES)

**Prioridad:** Alta

**Módulo:** `backend/src/modules/comercial` — Frontend `frontend/src/modules/comercial`

### Descripción funcional

Registra las **ventas directas presenciales** (POS) del punto de venta. Una venta
toma un cliente, un almacén desde el que se descuenta el stock, una lista de
variantes con cantidades, un descuento/impuesto y un **método de pago habilitado
para presencial** (CU16). Requiere que la sucursal tenga una **caja abierta**
(CU15), porque el cobro se imputa como un movimiento de caja.

Al confirmar, en una sola transacción se crean la nota de venta, sus detalles, el
pago, el movimiento de caja (`INGRESO`) y se **descuenta `inventario.stock_disponible`**
del almacén elegido.

### Reglas de negocio

1. **Cliente obligatorio:** la venta referencia un cliente existente (`cliente`).
2. **Caja abierta:** la sucursal debe tener una caja `Abierta` (CU15); si no,
   `409 Conflict`.
3. **Método de pago:** debe existir y estar `disponiblePresencial = true`; si no,
   `400`/`404`.
4. **Precio de línea:** se toma `producto.precio`; no se acepta precio manual.
5. **Stock:** debe existir una fila `inventario(almacén, variante)` con
   `stock_disponible >= cantidad` (`400` si no alcanza), y se descuenta al confirmar.
6. **Totales:** `subtotal = Σ (precio × cantidad)`, `total = subtotal − descuento + impuesto`.
   El total no puede ser negativo (`400`).
7. **Cajero:** la venta se ata al empleado autenticado (`id_cajero`); un
   administrador sin legajo queda sin cajero.
8. **Atomicidad:** la creación de la venta afecta a más de 2 tablas → se ejecuta
   en `dataSource.transaction`.
9. **Auditoría:** las mutaciones se registran en `BITACORA` (interceptor global).

### Flujo principal

1. **Registrar venta (`POST /api/comercial/ventas`):** recibe cliente, sucursal
   (solo admin), almacén, método de pago, descuento/impuesto e ítems. Responde la
   venta creada con sus detalles y pagos.
2. **Listar ventas (`GET /api/comercial/ventas`):** paginado, con filtros por
   `search` (código/factura), `idSucursal`, `idCajero` y rango de fechas.
3. **Ver detalle (`GET /api/comercial/ventas/:id`):** cabecera + detalles + pagos.

### Endpoints y permisos

| Método | Endpoint | Permiso |
| --- | --- | --- |
| GET | `/api/comercial/ventas` | `comercial:ventas:gestionar` |
| GET | `/api/comercial/ventas/:id` | `comercial:ventas:gestionar` |
| POST | `/api/comercial/ventas` | `comercial:ventas:gestionar` |

Para armar el POS, el cajero necesita **leer** almacenes y stock. Se agrega el
permiso `inventario:almacen:leer` y los `GET` de almacenes/stock aceptan
`inventario:almacen:gestionar` **o** `inventario:almacen:leer`.

> El rol `ADMINISTRADOR` accede siempre. `VENDEDOR_CAJERO` y `ENCARGADO_SUCURSAL`
> reciben `comercial:ventas:gestionar` e `inventario:almacen:leer`.

### Interfaz

* `/admin/ventas`: listado paginado con filtros, botón "Nueva venta" (selector de
  cliente, almacén, ítems variante+cantidad con precio automático, descuento,
  impuesto, método de pago y totales) y modal de detalle.

### Tablas implicadas

| Tabla | Operación | Motivo |
| --- | --- | --- |
| `nota_venta` | Escritura | Cabecera de la venta |
| `detalle_nota_venta` | Escritura | Líneas de la venta |
| `pago` | Escritura | Registro del cobro (`PAGO_TOTAL`) |
| `movimiento_caja` | Escritura | Ingreso del efectivo en caja |
| `inventario` | Lectura/Escritura | Validación y descuento de stock |
| `caja` | Lectura | Verificación de caja abierta |
| `cliente`, `pasarela_de_pago`, `variante_producto`, `producto` | Lectura | Validación y precios |
| `bitacora` | Escritura | Auditoría |

### Notas / trabajo futuro

* **No** se incluyen devoluciones/anulaciones (`NOTA_DEVOLUCION`) ni reservas
  (`RESERVA`, `ANTICIPO_RESERVA`, `PRESENCIAL_LIQUIDACION`); quedan como CUs aparte.
* No se cobra con pasarelas `API` (PayPal no está habilitado para presencial).
* El almacén de la venta no se persiste en `nota_venta` (el esquema no lo tiene);
  solo se usa para descontar stock.
* El código de nota se genera como `NV-######`.
