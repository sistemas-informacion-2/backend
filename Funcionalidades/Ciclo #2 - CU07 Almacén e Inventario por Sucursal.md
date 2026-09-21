# Especificación Detallada de Funcionalidades - Ciclo #2

---

## CU07 – Gestionar Almacén e Inventario por Sucursal

**Actores:** Administrador (A), Encargado de Stock (ES), Encargado de Inventario (EI)

**Prioridad:** Alta

**Módulo:** `backend/src/modules/inventario` — Frontend `frontend/src/modules/inventario`

### Descripción funcional

Administra los **almacenes** (depósitos físicos de cada sucursal) y las **existencias** de cada variante de producto en cada almacén. Introduce el **stock real** por almacén, distinto de `producto_sucursal` (que solo marca disponibilidad sin cantidades).

Cada registro de inventario lleva `stock_disponible`, `stock_reservado`, `stock_minimo` y `stock_maximo`, con alerta de reposición cuando `stock_disponible <= stock_minimo`. `stock_reservado` queda listo para el carrito/ventas (CU13/CU12) y no se edita manualmente.

### Reglas de negocio

1. **Almacén:** debe pertenecer a una sucursal existente; el nombre es único dentro de la sucursal (`409` si se repite).
2. **Unicidad de stock:** una sola fila por `(almacén, variante)` (`409` si se intenta registrar dos veces).
3. **Stock no negativo:** una salida no puede dejar `stock_disponible` por debajo de 0 (`400`).
4. **Ajustes:** `ENTRADA` suma, `SALIDA` resta, `AJUSTE` fija el valor absoluto.
5. **Niveles:** `stock_maximo >= stock_minimo` (`400` en caso contrario).
6. **Auditoría:** las mutaciones se registran en `BITACORA`.

### Flujo principal

1. **Listar almacenes (`GET /api/inventario/almacenes`):** filtros por `search`, `idSucursal` y `activo`.
2. **Crear/editar almacén (`POST` / `PUT /api/inventario/almacenes[/:id]`):** sucursal, nombre, ubicación física y estado.
3. **Listar existencias (`GET /api/inventario/stock`):** paginado, con filtros por `idAlmacen`, `idSucursal`, `search` (SKU/producto) y `bajoMinimo`.
4. **Registrar variante en almacén (`POST /api/inventario/stock`):** elige almacén + variante (producto → variante) e inicializa el stock.
5. **Editar niveles (`PUT /api/inventario/stock/:id`):** actualiza mínimo y máximo.
6. **Ajustar stock (`PATCH /api/inventario/stock/:id/ajuste`):** entrada, salida o ajuste, con motivo opcional.

### Endpoints y permisos

| Método | Endpoint | Permiso |
| --- | --- | --- |
| GET | `/api/inventario/almacenes` | `inventario:almacen:gestionar` |
| GET | `/api/inventario/almacenes/:id` | `inventario:almacen:gestionar` |
| POST | `/api/inventario/almacenes` | `inventario:almacen:gestionar` |
| PUT | `/api/inventario/almacenes/:id` | `inventario:almacen:gestionar` |
| GET | `/api/inventario/stock` | `inventario:almacen:gestionar` |
| GET | `/api/inventario/stock/:id` | `inventario:almacen:gestionar` |
| POST | `/api/inventario/stock` | `inventario:almacen:gestionar` |
| PUT | `/api/inventario/stock/:id` | `inventario:almacen:gestionar` |
| PATCH | `/api/inventario/stock/:id/ajuste` | `inventario:almacen:gestionar` |

> El permiso `inventario:almacen:gestionar` se asigna al rol `ENCARGADO_INVENTARIO`; el `ADMINISTRADOR` accede siempre.

### Interfaz

* `/admin/almacenes`: CRUD de almacenes (selector de sucursal, ubicación, estado).
* `/admin/stock`: existencias con filtros (almacén, sucursal, SKU/producto, "solo bajo mínimo"), registro de stock (producto → variante) y ajustes.

### Tablas implicadas

| Tabla | Operación | Motivo |
| --- | --- | --- |
| `almacen` | CRUD | Depósitos físicos por sucursal |
| `inventario` | CRUD | Existencias por almacén y variante |
| `sucursal` | Lectura | Validación de pertenencia |
| `variante_producto` | Lectura | Variante asociada al stock |
| `bitacora` | Escritura | Auditoría de operaciones |

### Notas / trabajo futuro

* No se registra un historial de movimientos (los ajustes solo actualizan el contador); puede agregarse luego una tabla `movimiento_inventario`.
* `stock_reservado` será consumido por el carrito (CU13) y las ventas (CU12); compras (CU14) incrementarán `stock_disponible`.
