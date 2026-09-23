* **inventario**
* **CU08 – Gestionar Almacén e Inventario por Sucursal:** Administra la creación de almacenes físicos por sucursal, el control de existencias, ajustes de stock y configuración de umbrales mínimos/máximos.


* **comercial**
* **CU13 – Gestionar Ventas Presenciales:** Controla las transacciones en el punto de venta (POS), la facturación, emisión de cobros y el descuento automático de existencias.

* **CU15 – Gestionar Compras:** Registra las adquisiciones de mercadería a proveedores, actualiza el inventario por lotes y vincula los egresos de tesorería.

* **CU16 – Gestionar Caja:** Maneja la apertura, movimientos monetarios (ingresos/egresos), arqueos y cierres de caja por sucursal.

* **CU17 – Gestionar Métodos de Pago:** Configura y parametriza las pasarelas de pago (QR, tarjetas, efectivo), comisiones y claves de integración encriptadas.

* **electronico**
* **CU14 – Gestionar Carrito Virtual:** Permite la adición, edición y eliminación de prendas/variantes dentro de la sesión digital del cliente.

* **CU19 – Configurar Probador Virtual:** Procesa la superposición de prendas 2D/3D mediante detección de pose sobre la imagen/stream del usuario.

* **CU20 – Configurar Notificaciones Push:** Gestiona el envío y recepción de alertas y mensajes masivos o personalizados hacia los usuarios.


* **reportes**
* **CU18 – Gestionar Reportes Dinámicos y Generativos:** Consolida información mediante filtros parametrizados y consultas en lenguaje natural.


## CU08 – Gestionar Almacén e Inventario por Sucursal

**Actor:** Administrador (A), Encargado de Sucursal (ES), Encargado de Inventario (EI)

**Prioridad:** Alta

### Descripción funcional

Permite gestionar la creación de almacenes físicos asociados a cada sucursal y administrar la disponibilidad real y reservada de cada variante de producto (`talla`, `color`, `corte`), controlando los umbrales de stock mínimo y máximo.

### Flujo principal

1. **Listar Almacenes e Inventario (`GET /api/inventario/almacenes`, `GET /api/inventario/stock`):**
* El usuario filtra por `id_sucursal`, `id_almacen` o busca variantes por `sku`.
* El sistema calcula las existencias basándose en `stock_disponible` y `stock_reservado`.


2. **Crear Almacén (`POST /api/inventario/almacenes`):**
* Pide `id_sucursal`, `nombre` y `ubicacion_fisica`.
* Registra la entidad `ALMACEN` activa.


3. **Ajuste y Control de Stock (`PATCH /api/inventario/stock/:id`):**
* Permite actualizar `stock_minimo`, `stock_maximo` o realizar correcciones directas de `stock_disponible` por inventario físico.
* Genera una entrada en la `BITACORA` detallando los valores anteriores y nuevos.



### Tablas implicadas

| Tabla | Operación | Motivo |
| --- | --- | --- |
| `ALMACEN` | CRUD | Definición de ubicaciones físicas de almacenamiento por sucursal |
| `INVENTARIO` | CRUD | Control del stock disponible, reservado y umbrales mínimos/máximos |
| `VARIANTE_PRODUCTO` | Lectura | Consulta de detalles específicos de prendas (SKU, talla, color) |
| `SUCURSAL` | Lectura | Validación de pertenencia organizativa del almacén |

---

## CU17 – Gestionar Métodos de Pago

**Actor:** Administrador (A)

**Prioridad:** Media

### Descripción funcional

Configura y parametriza las pasarelas de pago disponibles para transacciones presenciales y electrónicas (ej. QR, Tarjeta de Crédito/Débito, Transferencia, Efectivo), definiendo comisiones y credenciales encriptadas.

### Flujo principal

1. **Listar Pasarelas (`GET /api/comercial/pasarelas`):**
* Retorna las pasarelas de pago registradas con su estado (`activa`) y porcentaje de comisión.


2. **Crear/Editar Pasarela (`POST` / `PUT /api/comercial/pasarelas`):**
* Pide `metodo`, `descripcion`, `api_key_encriptada` y `comision_porcentaje`.
* La clave API se encripta mediante AES-256 antes de guardarse en la base de datos.


3. **Activar/Desactivar Pasarela (`PATCH /api/comercial/pasarelas/:id/estado`):**
* Cambia el valor booleano de `activa`, habilitando o deshabilitando la opción en el POS y Checkout virtual.



### Tablas implicadas

| Tabla | Operación | Motivo |
| --- | --- | --- |
| `PASARELA_DE_PAGO` | CRUD | Registro maestro de pasarelas, comisiones y claves de integración |

---

## CU16 – Gestionar Caja

**Actor:** Vendedor/Cajero (VC), Encargado de Sucursal (ES), Administrador (A)

**Prioridad:** Alta

### Descripción funcional

Permite la apertura, control de flujo monetario en tiempo real (ingresos y egresos) y cierre de caja por sucursal, garantizando la consistencia financiera de las ventas presenciales y cobros.

### Flujo principal

1. **Apertura de Caja (`POST /api/comercial/caja/apertura`):**
* Valida que la sucursal no tenga una caja previa en estado `'Abierta'`.
* Registra `id_sucursal`, `monto_inicial`, `fecha_apertura` y `hora_apertura`. Setea `estado = 'Abierta'`.


2. **Registrar Movimiento ManuaI (`POST /api/comercial/caja/movimiento`):**
* Pide `id_caja`, `tipo` ('INGRESO' | 'EGRESO'), `concepto`, `monto` y `observaciones`.
* Inserta un registro en `MOVIMIENTO_CAJA`.


3. **Cierre de Caja (`POST /api/comercial/caja/cierre`):**
* Calcula el arqueo teórico sumando `monto_inicial` + cobros presenciales + ingresos manuales - egresos.
* Recibe el `monto_final` (efectivo contado en físico).
* Registra `fecha_cierre`, `hora_cierre` y cambia `estado = 'Cerrada'`.



### Tablas implicadas

| Tabla | Operación | Motivo |
| --- | --- | --- |
| `CAJA` | CRUD | Registro de períodos operables de caja por sucursal |
| `MOVIMIENTO_CAJA` | CRUD | Trazabilidad de cada entrada/salida de dinero durante el turno |
| `SUCURSAL` | Lectura | Contextualización de la caja a su respectiva sede física |

---

## CU15 – Gestionar Compras

**Actor:** Administrador (A), Encargado de Compras (EC)

**Prioridad:** Media

### Descripción funcional

Administra las notas de compra de mercadería a proveedores, actualizando de forma automática el stock disponible en los almacenes seleccionados e incrementando el inventario por lotes.

### Flujo principal

1. **Listar Notas de Compra (`GET /api/comercial/compras`):**
* Retorna las compras realizadas con filtros por `id_proveedor`, rango de fechas o nro de factura.


2. **Registrar Nota de Compra (`POST /api/comercial/compras`):**
* Recibe `id_proveedor`, `nro_factura`, `fecha_entrega_programada` y un arreglo de detalles (`id_variante_producto`, `id_almacen`, `cantidad`, `precio_unitario`, `nro_lote`).
* **Inicia Transacción Prisma (`$transaction`):**
* Inserta la cabecera en `NOTA_COMPRA`.
* Inserta los ítems en `DETALLE_NOTA_COMPRA`.
* Por cada ítem, actualiza la tabla `INVENTARIO` incrementando `stock_disponible += cantidad` en el almacén especificado.
* Si la compra se paga en efectivo de caja, genera un registro en `MOVIMIENTO_CAJA` vinculando el `id_movimiento_caja`.





### Tablas implicadas

| Tabla | Operación | Motivo |
| --- | --- | --- |
| `NOTA_COMPRA` | CRUD | Cabecera del pedido de adquisición a proveedores |
| `DETALLE_NOTA_COMPRA` | Escritura | Desglose de variantes, almacenes de destino y costo unitario |
| `INVENTARIO` | Escritura | Incremento automático del stock al recibir mercadería |
| `PROVEEDOR` | Lectura | Vinculación del origen del abastecimiento |
| `MOVIMIENTO_CAJA` | Escritura (Opcional) | Egreso de efectivo si la compra afecta la caja activa |

---

## CU13 – Gestionar Ventas Presenciales

**Actor:** Vendedor/Cajero (VC), Encargado de Sucursal (ES)

**Prioridad:** Alta

### Descripción funcional

Permite registrar ventas directas en el punto de venta (POS) presencial, procesar cobros combinados, emitir comprobantes/facturas y descontar inventario en tiempo real.

### Flujo principal

1. **Crear Nota de Venta Presencial (`POST /api/comercial/ventas`):**
* Pide `id_cliente`, `id_sucursal`, `nit_razon_social`, `tipo_venta` ('DIRECTA_PRESENCIAL') y lista de ítems (`id_variante_producto`, `cantidad`, `precio_unitario`).
* Valida que la caja de la sucursal esté 'Abierta' y que exista `stock_disponible` en los almacenes asociados.


2. **Procesar Pago y Descuento de Stock (`$transaction`):**
* Genera `codigo_nota` único.
* Registra `NOTA_VENTA` y `DETALLE_NOTA_VENTA`.
* Crea un `MOVIMIENTO_CAJA` tipo 'INGRESO'.
* Crea el registro en `PAGO` enlazado al `id_movimiento_caja` y a la pasarela elegida (Efectivo/QR).
* Descuenta en `INVENTARIO` el `stock_disponible -= cantidad`.



### Tablas implicadas

| Tabla | Operación | Motivo |
| --- | --- | --- |
| `NOTA_VENTA` | CRUD | Registro maestro de la transacción comercial |
| `DETALLE_NOTA_VENTA` | Escritura | Desglose de variantes vendidas y montos |
| `PAGO` | Escritura | Detalle del método y concepto monetario cobrado |
| `MOVIMIENTO_CAJA` | Escritura | Registro del ingreso financiero en la caja activa |
| `INVENTARIO` | Escritura | Descuento automático del stock por cada variante vendida |
| `CLIENTE` | Lectura | Identificación del comprador |

---

## CU14 – Gestionar Carrito Virtual

**Actor:** Cliente (C)

**Prioridad:** Alta

### Descripción funcional

Otorga la capacidad al cliente de agregar, modificar y eliminar productos y sus variantes dentro de su sesión digital, calculando subtotales y preparando el pedido para la conversión a venta e-commerce o reserva.

### Flujo principal

1. **Obtener Carrito (`GET /api/electronico/carrito`):**
* Consulta la cabecera `CARRITO` mediante el `id_cliente` extraído del JWT.
* Retorna la lista de `DETALLE_CARRITO` con la foto, nombre del producto, talla, color y subtotal.


2. **Agregar/Modificar Variante (`POST /api/electronico/carrito/items`):**
* Pide `id_variante_producto`, `cantidad` y `notas_especiales`.
* Si la variante ya existe en `DETALLE_CARRITO`, incrementa la cantidad; de lo contrario, la inserta.
* Recalcula `subtotal = cantidad * precio_unitario`.


3. **Eliminar Ítem o Limpiar Carrito (`DELETE /api/electronico/carrito/items/:id`):**
* Remueve la variante del detalle y actualiza la marca temporal de `fecha_actualizacion`.



### Tablas implicadas

| Tabla | Operación | Motivo |
| --- | --- | --- |
| `CARRITO` | CRUD | Contenedor principal de la sesión de compra del cliente |
| `DETALLE_CARRITO` | CRUD | Ítems, cantidades y precios acumulados |
| `VARIANTE_PRODUCTO` | Lectura | Obtención de precio, talla, color e imagen de la prenda |

---

## CU19 – Configurar Probador Virtual

**Actor:** Cliente (C)

**Prioridad:** Media

### Descripción funcional

Permite al cliente probarse virtualmente prendas desde el catálogo utilizando su cámara web. Utiliza detección de pose (landmarks) sobre la postura del usuario para escalar y superponer la prenda 2D o el modelo 3D en tiempo real.

### Flujo principal

1. **Obtener Assets de la Variante (`GET /api/electronico/probador/variante/:id`):**
* Devuelve las imágenes de alta resolución (frente/espalda) o el enlace al `modelo_3d_url` registrado en `VARIANTE_PRODUCTO`.


2. **Procesamiento e Interacción local (Cliente React):**
* El cliente carga el stream de video de la webcam y ejecuta la lib MediaPipe Pose localmente.
* Evalúa la posición $X, Y, Z$ de los hombros (landmarks 11 y 12) para estimar la escala y detectar giros de frente o espalda.
* Renderiza la textura sobre la capa superior del canvas o lienzo Three.js.


3. **Sincronización con el Carrito:**
* Al confirmar el calce en el probador, la interfaz permite presionar "Agregar esta prenda al Carrito", invocando el flujo del `CU14`.



### Tablas implicadas

| Tabla | Operación | Motivo |
| --- | --- | --- |
| `VARIANTE_PRODUCTO` | Lectura | Extracción de la URL del modelo 3D, cortes, color y especificaciones |
| `PRODUCTO` | Lectura | Carga de información general e imágenes |
| `IMAGEN_PRODUCTO` | Lectura | Obtención de capas multimedia para superposición en canvas |

---

## CU20 – Configurar Notificaciones Push

**Actor:** Administrador (A)

**Prioridad:** Baja

### Descripción funcional

Permite al Administrador estructurar y enviar alertas dirigidas a usuarios o clientes sobre promociones, cambios de estado en sus reservas o actualizaciones de pedidos.

### Flujo principal

1. **Enviar Notificación Push (`POST /api/electronico/notificaciones`):**
* Recibe `id_usuario` (o un criterio masivo por `tipo_usuario`), `titulo` y `mensaje`.
* Registra la fila en `NOTIFICACION_PUSH` con `leido = FALSE`.


2. **Listar y Marcar como Leída (`GET / PATCH /api/electronico/notificaciones/mis-notificaciones`):**
* El cliente autenticado consulta sus notificaciones pendientes.
* Al abrir el panel de alertas, actualiza `leido = TRUE`.



### Tablas implicadas

| Tabla | Operación | Motivo |
| --- | --- | --- |
| `NOTIFICACION_PUSH` | CRUD | Almacenamiento de mensajes, estados de lectura y fechas de envío |
| `USUARIO` | Lectura | Destinatarios de los mensajes informativos |

---

## CU18 – Gestionar Reportes Dinámicos y Generativos

**Actor:** Administrador (A), Encargado de Sucursal (ES)

**Prioridad:** Media

### Descripción funcional

Genera consolidados de información cruzando datos de ventas, stock, movimientos de caja y rotación de inventarios por temporada, permitiendo consultas mediante filtros predeterminados o mediante promts en lenguaje natural (reportes generativos).

### Flujo principal

1. **Generar Reporte Dinámico (`POST /api/analitica/reportes/dinamico`):**
* Recibe criterios de filtrado: `id_sucursal`, `id_temporada`, rango de fechas y módulo base ('VENTAS', 'INVENTARIO', 'COMPRAS').
* Consulta las tablas correspondientes y retorna una estructura JSON lista para exportar a Excel o PDF.


2. **Consulta Generativa (`POST /api/analitica/reportes/generativo`):**
* El usuario ingresa un prompt (ej. *"Muéstrame las 5 prendas más vendidas en la sucursal Central durante este mes"*).
* El backend procesa la consulta utilizando un motor analítico, construye la consulta SQL de lectura, ejecuta sobre PostgreSQL y retorna los datos tabulados.



### Tablas implicadas

| Tabla | Operación | Motivo |
| --- | --- | --- |
| `NOTA_VENTA` | Lectura | Consolidados de volumen de venta e ingresos |
| `INVENTARIO` | Lectura | Análisis de existencias, rotación y productos en punto crítico |
| `NOTA_COMPRA` | Lectura | Evaluación de egresos y costos de abastecimiento |
| `SUCURSAL` | Lectura | Segmentación territorial del desempeño comercial |

---

## CU22 – Gestionar Dashboard Administrativo

**Actor:** Administrador (A)

**Prioridad:** Alta

### Descripción funcional

Ofrece una vista ejecutiva e interactiva consolidando Indicadores Clave de Desempeño (KPIs) en tiempo real: ventas totales del día, cajas abiertas, productos en stock crítico y gráfico de ingresos comparativo entre sucursales.

### Flujo principal

1. **Obtener Resumen Ejecutivo (`GET /api/analitica/dashboard/resumen`):**
* Ejecuta agregaciones paralelas sobre la BD:
* **Total Ventas Día:** $\sum \text{monto\_total}$ en `NOTA_VENTA` para `fecha_emision = CURRENT_DATE`.
* **Estado Cajas:** Conteo de registros en `CAJA` donde `estado = 'Abierta'`.
* **Alertas de Stock:** Conteo en `INVENTARIO` donde `stock_disponible <= stock_minimo`.
* **Top Variantes:** Top 5 productos con mayor suma de cantidades en `DETALLE_NOTA_VENTA`.




2. **Renderizado en Frontend:**
* Visualiza widgets con métricas rápidas, gráficos de líneas (tendencia de ventas) y tablas resumidas de alertas de inventario.



### Tablas implicadas

| Tabla | Operación | Motivo |
| --- | --- | --- |
| `NOTA_VENTA` | Lectura | Cálculo de ventas acumuladas y promedios por ticket |
| `CAJA` | Lectura | Estado operativo global de las tesorerías |
| `INVENTARIO` | Lectura | Detección de productos que requieren reabastecimiento |
| `VARIANTE_PRODUCTO` | Lectura | Identificación de los artículos con mayor rotación |



A continuación se presentan las especificaciones funcionales detalladas para los casos de uso **CU23: Gestionar Reservas** y **CU24: Gestionar Devoluciones**, alineadas estrictamente al esquema DDL, las reglas de negocio transaccionales, las tablas (`RESERVA`, `NOTA_DEVOLUCION`, `INVENTARIO`, `PAGO`, `NOTA_VENTA`, `CAJA`, `MOVIMIENTO_CAJA`, etc.) y los tipos enumerados provistos (`estado_reserva_enum`, `tipo_devolucion_enum`, `motivo_devolucion_enum`, `estado_producto_devolucion_enum`, `concepto_pago_enum`).

---

## CU23 – Gestionar Reservas

### 1. Descripción Breve

Permite a un cliente (desde el E-Commerce) o a un vendedor/cajero (en sucursal) apartar temporalmente prendas de vestir reduciendo el stock disponible e incrementando el stock reservado. Registra el pago del anticipo, administra la liquidación de la reserva al convertirla en compra presencial/e-commerce y controla el flujo de vencimiento/cancelación automática con liberación de inventario.

### 2. Actores

* **Cliente (C):** Crea la reserva desde la plataforma E-Commerce pagando un anticipo.
* **Vendedor / Cajero (VC / ES):** Crea reservas presenciales, consulta el estado, procesa la liquidación (saldo restante) y entrega el producto en sucursal.
* **Administrador / Sistema (A / Cron Job):** Procesa la cancelación por vencimiento de tiempo límite.

### 3. Precondiciones

* El cliente debe estar autenticado (`CLIENTE` vinculado a `USUARIO`).
* Las variantes de producto solicitadas deben contar con `stock_disponible >= cantidad` en el `INVENTARIO` del `ALMACEN` perteneciente a la `SUCURSAL` elegida.
* Para transacciones con cobro de anticipo en caja presencial, la `CAJA` de la sucursal debe estar en estado `'Abierta'`.

---

### 4. Flujos de Trabajo (Sub-Funcionalidades)

#### A. Crear Reserva (E-Commerce o Presencial)

1. El usuario selecciona la `SUCURSAL`, las variantes de producto (`VARIANTE_PRODUCTO`) y las cantidades deseada.
2. El sistema verifica la disponibilidad en la tabla `INVENTARIO`:
* Si `stock_disponible < cantidad`, el sistema rechaza la solicitud.


3. Se calcula el `monto_total` (suma de `DETALLE_RESERVA.subtotal`) y el `monto_anticipo` mínimo parametrizado (ej. 20% o valor fijo).
4. El sistema registra la cabecera en `RESERVA`:
* Genera un `codigo_reserva` único.
* Establece `estado = 'PENDIENTE'`.
* Asigna `fecha_limite` (ej. 48 o 72 horas a partir del momento actual).


5. Se insertan los ítems en `DETALLE_RESERVA`.
6. **Actualización de Inventario (Transaccional):**
* En `INVENTARIO` del almacén de la sucursal asignada:
* $\text{stock\_disponible} = \text{stock\_disponible} - \text{cantidad}$
* $\text{stock\_reservado} = \text{stock\_reservado} + \text{cantidad}$





#### B. Registrar Pago de Anticipo

1. Una vez creada la reserva en estado `'PENDIENTE'`, se efectúa el cobro del anticipo vía pasarela online (`PASARELA_DE_PAGO`) o por caja física.
2. Si es presencial, se asocia o crea un registro en `MOVIMIENTO_CAJA` (tipo `'INGRESO'`, concepto `'ANTICIPO_RESERVA'`).
3. Se inserta un registro en la tabla `PAGO`:
* `id_reserva` = ID de la reserva.
* `concepto` = `'ANTICIPO_RESERVA'`.
* `monto` = `monto_anticipo`.


4. Si la reserva recibe la cobertura del anticipo requerido, el `estado` de la `RESERVA` cambia a `'PAGADA'`.

#### C. Liquidar y Completar Reserva (Conversión a Venta)

1. El cliente se apersona a la sucursal (o liquida en línea) proporcionando el `codigo_reserva`.
2. El cajero busca la reserva activa en estado `'PAGADA'` o `'PENDIENTE'`.
3. El sistema calcula el saldo pendiente: $\text{monto\_total} - \text{monto\_anticipo}$.
4. El cliente abona el saldo restante:
* Se registra el pago en `PAGO` con `concepto = 'SALDO_LIQUIDACION'`.
* Se genera un `MOVIMIENTO_CAJA` por el monto del saldo abonado.


5. **Generación de la Nota de Venta:**
* Se crea un registro en `NOTA_VENTA` con `tipo_venta = 'PRESENCIAL_LIQUIDACION'` (o `'E_COMMERCE'`), enlazando `id_reserva` y calculando `monto_anticipo_aplicado`.
* Se registran las líneas correspondientes en `DETALLE_NOTA_VENTA`.


6. **Descuento definitivo del Inventario:**
* En `INVENTARIO`:
* $\text{stock\_reservado} = \text{stock\_reservado} - \text{cantidad}$
*(Nota: `stock_disponible` ya fue descontado al crear la reserva).*




7. El `estado` de la `RESERVA` se actualiza a `'COMPLETADA'`.

#### D. Cancelar Reserva y Liberar Stock (Manual o Por Vencimiento)

1. **Ejecución automática/manual:** Si la `fecha_limite` se excede sin completarse la compra, o si el cliente decide cancelar.
2. El `estado` de la `RESERVA` pasa a `'CANCELADA'`.
3. **Reversión de Inventario (Transaccional):**
* En `INVENTARIO`:
* $\text{stock\_reservado} = \text{stock\_reservado} - \text{cantidad}$
* $\text{stock\_disponible} = \text{stock\_disponible} + \text{cantidad}$




4. Si existía un anticipo cobrado y las políticas no permiten retención, se puede derivar el proceso a `CU24 (Gestionar Devoluciones)` con `tipo_devolucion = 'CANCELACION_RESERVA'` para gestionar el reembolso en la tabla `NOTA_DEVOLUCION`.

---

## CU24 – Gestionar Devoluciones

### 1. Descripción Breve

Procesa las devoluciones de dinero y/o retornos físicos de mercancía provenientes de ventas realizadas (`NOTA_VENTA`) o reservas canceladas con anticipo abonado (`RESERVA`). Permite clasificar la causa del retorno, determinar el destino físico de la prenda (reingreso a almacén o merma por defecto) y generar los correspondientes egresos de caja o reembolsos digitales.

### 2. Actores

* **Cajero / Encargado de Sucursal (VC / ES):** Recibe la prenda, evalúa el estado del producto, registra la devolución en el sistema y efectúa el desembolso o reembolso.
* **Administrador (A):** Modifica configuraciones relativas a políticas de devolución y autoriza reembolsos excepcionales fuera de plazo.

### 3. Precondiciones

* Debe existir una `NOTA_VENTA` pagada o una `RESERVA` cancelada que respalde la transacción.
* Para devoluciones presenciales en efectivo o tarjeta posnet, la `CAJA` de la sucursal receptora debe estar `'Abierta'`.
* El plazo de garantía/devolución establecido por la empresa debe estar vigente respecto a `fecha_emision` de la nota de venta.

---

### 4. Flujos de Trabajo (Sub-Funcionalidades)

#### A. Iniciar y Validar Solicitud de Devolución

1. El cajero ingresa el `codigo_nota` de la `NOTA_VENTA` o el `codigo_reserva` de la `RESERVA`.
2. El sistema despliega el detalle de la venta o reserva (productos, cantidades, precios unitarios abonados).
3. El cajero selecciona la variante a devolver y la cantidad solicitada (comprobando que la cantidad acumulada devuelta no supere la cantidad comprada originalmente en `DETALLE_NOTA_VENTA`).
4. Se clasifica el registro en `NOTA_DEVOLUCION`:
* **`tipo_devolucion`:** `PRODUCTO_ENTREGADO` (retorno de venta) o `CANCELACION_RESERVA` (reembolso de anticipo).
* **`motivo_devolucion`:** `FALLA_FABRICA`, `TALLA_INCORRECTA`, `ARREPENTIMIENTO` o `CANCELACION`.



#### B. Inspección Física y Destino de Inventario

Por cada ítem registrado en la devolución (`DETALLE_NOTA_DEVOLUCION`), el usuario selecciona el almacén de destino (`id_almacen`) y determina el `estado_producto`:

1. **`REINGRESO_INVENTARIO` (Apto para la venta):**
* La prenda está nueva/sellada.
* **Transacción en `INVENTARIO`:**
* $\text{stock\_disponible} = \text{stock\_disponible} + \text{cantidad}$




2. **`MERMA_DEFECTUOSO` (Prenda dañada/defectuosa):**
* La prenda ingresa a un almacén de bajas/mermas o no incrementa el stock vendible comercialmente. No altera el `stock_disponible` operativo (o se registra en un almacén de fallados para control interno).


3. **`NO_APLICA`:**
* Utilizado cuando la devolución es puramente financiera (ej. `CANCELACION_RESERVA` donde la prenda jamás salió de la tienda ni cambió su flujo de reserva previo).



#### C. Procesamiento del Reembolso y Salida de Tesorería

1. El sistema calcula el `monto_total_reembolsado` sumando los subtotales de `DETALLE_NOTA_DEVOLUCION` (o el total del anticipo a devolver en caso de reservas).
2. **Registro de Movimiento Monetario:**
* Se crea un registro en `MOVIMIENTO_CAJA`:
* `tipo` = `'EGRESO'`
* `concepto` = `'REEMBOLSO_DEVOLUCION'`
* `monto` = `monto_total_reembolsado`
* Asignado a la `CAJA` actual del cajero.




3. **Registro de Pago:**
* Se inserta un registro en `PAGO`:
* `concepto` = `'REEMBOLSO'`.
* `id_nota_venta` o `id_reserva` según corresponda.
* `id_movimiento_caja` = ID del egreso generado.




4. **Finalización de la Nota:**
* Se guarda la cabecera en `NOTA_DEVOLUCION` generando su `codigo_devolucion` único y vinculando el `id_movimiento_caja`, `id_cajero`, `id_cliente` y `id_sucursal`.



#### D. Auditoría y Notificación

1. Se inserta un evento en la tabla `BITACORA` documentando el ajuste de inventario y el egreso financiero.
2. Si la devolución fue de una compra e-commerce, se emite un registro en `NOTIFICACION_PUSH` para alertar al cliente del reembolso exitoso.

---

### Resumen de Interacción de Enums por Caso de Uso

| Caso de Uso | Enum Utilizado | Valores Clave Aplicados |
| --- | --- | --- |
| **CU23 – Reservas** | `estado_reserva_enum` | `PENDIENTE`, `PAGADA`, `CANCELADA`, `COMPLETADA` |
| **CU23 – Reservas** | `tipo_nota_venta_enum` | `ANTICIPO_RESERVA`, `PRESENCIAL_LIQUIDACION` |
| **CU23 – Reservas** | `concepto_pago_enum` | `ANTICIPO_RESERVA`, `SALDO_LIQUIDACION` |
| **CU24 – Devoluciones** | `tipo_devolucion_enum` | `PRODUCTO_ENTREGADO`, `CANCELACION_RESERVA` |
| **CU24 – Devoluciones** | `motivo_devolucion_enum` | `FALLA_FABRICA`, `TALLA_INCORRECTA`, `ARREPENTIMIENTO`, `CANCELACION` |
| **CU24 – Devoluciones** | `estado_producto_devolucion_enum` | `REINGRESO_INVENTARIO`, `MERMA_DEFECTUOSO`, `NO_APLICA` |
| **CU24 – Devoluciones** | `concepto_pago_enum` | `REEMBOLSO` |