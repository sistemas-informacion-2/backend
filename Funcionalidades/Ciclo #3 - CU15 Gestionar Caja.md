# Especificación Detallada de Funcionalidades - Ciclo #3

---

## CU15 – Gestionar Caja

**Actores:** Vendedor/Cajero (VC), Encargado de Sucursal (ES), Administrador (A)

**Prioridad:** Alta

**Módulo:** `backend/src/modules/comercial` — Frontend `frontend/src/modules/comercial`

### Descripción funcional

Administra las **cajas** (turnos de efectivo) de cada sucursal y sus **movimientos**
de ingreso/egreso. Cada apertura de caja queda **atada al cajero** que la realiza
(`caja.id_cajero` → `empleado.id_usuario`), de modo que se conoce quién es el
responsable del turno. Una sucursal solo puede tener **una caja `Abierta` a la vez**.

Al cerrar, el sistema calcula el **monto esperado** (`monto_inicial + ingresos − egresos`)
y guarda el `monto_final` contado, además de la fecha/hora de cierre. Los movimientos
quedan registrados con su tipo (`INGRESO`/`EGRESO`), concepto, monto y observaciones.

Esta CU es la base del flujo de dinero: las ventas presenciales (CU12) y las compras
(CU14) referenciarán un `movimiento_caja` para imputar su cobro/pago.

### Reglas de negocio

1. **Una caja abierta por sucursal:** no se puede abrir una nueva caja si la sucursal
   ya tiene una `Abierta` (`409 Conflict`).
2. **Sucursal válida:** la caja debe pertenecer a una sucursal existente (`404`).
3. **Caja atada a cajero:** la apertura toma el usuario autenticado. Si es un empleado
   (`tipo_usuario = 'E'`) se guarda como `id_cajero`; si no tiene legajo (p. ej. el
   administrador) la caja queda sin cajero asignado (`id_cajero = NULL`).
4. **Montos no negativos:** `monto_inicial >= 0`, `monto_final >= 0` y el monto de
   cada movimiento es `> 0` (`400`).
5. **Movimientos solo con caja abierta:** no se registran ingresos/egresos sobre una
   caja `Cerrada` (`409`).
6. **Cierre:** solo se cierra una caja `Abierta`. Si no se informa `montoFinal`, se usa
   el **monto esperado** (`monto_inicial + ingresos − egresos`). El cierre setea
   `fecha_cierre`, `hora_cierre` y `estado = 'Cerrada'`.
7. **Cálculos:** el monto esperado se redondea a 2 decimales para evitar errores de coma
   flotante.
8. **Auditoría:** las mutaciones se registran en `BITACORA` (interceptor global).

### Flujo principal

1. **Listar cajas (`GET /api/comercial/cajas`):** filtros por `idSucursal`, `estado` y
   rango de fechas de apertura (`fechaDesde`, `fechaHasta`). Orden: apertura descendente.
2. **Consultar caja abierta (`GET /api/comercial/cajas/abierta?idSucursal=:`):** devuelve
   la caja `Abierta` de la sucursal o `null`.
3. **Abrir caja (`POST /api/comercial/cajas`):** recibe `idSucursal` y `montoInicial`.
   Valida la sucursal y la no existencia de otra caja abierta.
4. **Ver detalle (`GET /api/comercial/cajas/:id`):** incluye los movimientos y los totales.
5. **Registrar movimiento (`POST /api/comercial/cajas/:id/movimientos`):** `tipo`,
   `concepto`, `monto` y `observaciones` opcional.
6. **Listar movimientos (`GET /api/comercial/cajas/:id/movimientos`).**
7. **Cerrar caja (`PATCH /api/comercial/cajas/:id/cerrar`):** `montoFinal` opcional.

### Endpoints y permisos

| Método | Endpoint | Permiso |
| --- | --- | --- |
| GET | `/api/comercial/cajas` | `comercial:caja:gestionar` |
| GET | `/api/comercial/cajas/abierta` | `comercial:caja:gestionar` |
| GET | `/api/comercial/cajas/:id` | `comercial:caja:gestionar` |
| GET | `/api/comercial/cajas/:id/movimientos` | `comercial:caja:gestionar` |
| POST | `/api/comercial/cajas` | `comercial:caja:gestionar` |
| POST | `/api/comercial/cajas/:id/movimientos` | `comercial:caja:gestionar` |
| PATCH | `/api/comercial/cajas/:id/cerrar` | `comercial:caja:gestionar` |

> El rol `ADMINISTRADOR` accede siempre. `VENDEDOR_CAJERO` y `ENCARGADO_SUCURSAL`
> reciben `comercial:caja:gestionar`.
>
> En el controlador, la ruta `/abierta` se declara antes de `/:id`.

### Interfaz

* `/admin/caja`: selector de sucursal (para el administrador), panel de la caja abierta
  (cajero, monto inicial, ingresos, egresos y monto esperado), alta de ingresos/egresos,
  cierre de caja e historial de cajas por sucursal.

### Tablas implicadas

| Tabla | Operación | Motivo |
| --- | --- | --- |
| `caja` | CRUD | Turnos de caja por sucursal, atados a un cajero |
| `movimiento_caja` | CRUD | Ingresos y egresos del turno |
| `sucursal` | Lectura | Validación de pertenencia |
| `empleado` | Lectura | Identificación del cajero responsable |
| `bitacora` | Escritura | Auditoría de las operaciones |

### Cambio de esquema

`CAJA` incorpora la columna `id_cajero INT` con `FOREIGN KEY (id_cajero) →
EMPLEADO(id_usuario)`. Es nula para permitir que un administrador sin legajo abra una
caja.

### Notas / trabajo futuro

* `PAGO.id_movimiento_caja` es `NOT NULL`: las ventas presenciales (CU12) y el cobro de
  reservas deberán crear su movimiento de caja al registrar el pago.
* `NOTA_COMPRA.id_movimiento_caja` (CU14) podrá usar un movimiento de tipo `EGRESO`.
* No se registra arqueo detallado (billetes/monedas) ni historial de diferencias; el
  `monto_final` contado ya permite detectar descuadres contra el monto esperado.
