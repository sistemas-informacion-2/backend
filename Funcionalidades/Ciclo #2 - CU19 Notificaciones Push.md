# Especificación Detallada de Funcionalidades - Ciclo #2

---

## CU19 – Configurar Notificaciones Push

**Actor:** Administrador (A) — y cualquier usuario autenticado como consumidor de sus propias notificaciones.

**Prioridad:** Media

**Módulo:** `backend/src/modules/electronico` — Frontend `frontend/src/modules/electronico`

### Descripción funcional

Permite al Administrador **enviar notificaciones** a los usuarios del sistema y que cada usuario vea y administre las suyas dentro de la aplicación. El envío puede ser **individual** (a un usuario específico) o por **difusión a todos los clientes** (`tipo_usuario = 'C'` activos).

Las notificaciones se persisten en `NOTIFICACION_PUSH`; la entrega es **in-app con polling** (sin FCM/Web Push real ni WebSocket).

### Reglas de negocio

1. **Destinatario excluyente:** el envío debe indicar `idUsuario` **o** `difundirTodos`, nunca ambos ni ninguno (`400`).
2. **Difusión = fan-out:** como `id_usuario` es obligatorio, se crea **una fila por cliente** dentro de una transacción.
3. **Personalización:** el `mensaje` admite variables `{{nombre}}`, `{{apellido}}` y `{{email}}`, reemplazadas por los datos de cada destinatario al enviar (`utils/plantilla.util.ts`). Una variable desconocida se reemplaza por cadena vacía.
4. **Acceso a lo propio:** los endpoints `/mias` solo requieren JWT y siempre filtran por el usuario del token; un usuario no puede ver ni marcar notificaciones de otro.
5. **Auditoría:** las mutaciones se registran en `BITACORA`.

### Flujo principal

1. **Enviar notificación (`POST /api/electronico/notificaciones`):**
   * Recibe `titulo`, `mensaje` y `idUsuario` **o** `difundirTodos`.
   * Individual: valida que el usuario exista y esté activo, renderiza las variables y guarda una fila.
   * Difusión: obtiene los clientes activos, renderiza el mensaje por cada uno e inserta el lote en una transacción.
   * Responde `{ cantidadEnviada }`.

2. **Listar historial (`GET /api/electronico/notificaciones`):**
   * Paginado, con filtros por `idUsuario`, `leido`, `search` (título/mensaje) y rango `fechaDesde`/`fechaHasta`.

3. **Eliminar (`DELETE /api/electronico/notificaciones/:id`):**
   * Borrado físico de una notificación enviada.

4. **Ver las propias (`GET /api/electronico/notificaciones/mias`):**
   * Devuelve las notificaciones del usuario autenticado (mismos filtros, sin poder cambiar de destinatario).

5. **Contar no leídas (`GET /api/electronico/notificaciones/mias/no-leidas`):**
   * Alimenta el badge de la campanita.

6. **Marcar leída / todas leídas:**
   * `PATCH /api/electronico/notificaciones/mias/:id/leido`
   * `PATCH /api/electronico/notificaciones/mias/leer-todas`

### Endpoints y permisos

| Método | Endpoint | Permiso |
| --- | --- | --- |
| GET | `/api/electronico/notificaciones` | `electronico:notificaciones:gestionar` |
| POST | `/api/electronico/notificaciones` | `electronico:notificaciones:gestionar` |
| DELETE | `/api/electronico/notificaciones/:id` | `electronico:notificaciones:gestionar` |
| GET | `/api/electronico/notificaciones/destinatarios` | `electronico:notificaciones:gestionar` |
| GET | `/api/electronico/notificaciones/mias` | JWT |
| GET | `/api/electronico/notificaciones/mias/no-leidas` | JWT |
| PATCH | `/api/electronico/notificaciones/mias/leer-todas` | JWT |
| PATCH | `/api/electronico/notificaciones/mias/:id/leido` | JWT |

> Orden de rutas: `/mias`, `/mias/no-leidas` y `/mias/leer-todas` se declaran antes de `/:id`.

### Interfaz

* **Campanita (`NotificationBell`)** en `PublicLayout` (clientes) y `ProtectedLayout` (empleados/admin), con badge de no leídas. Consulta `/mias/no-leidas` cada ~30 s y refresca al marcar leídas.
* **Página administrativa** `/admin/notificaciones`: historial paginado con filtros, envío (individual o difusión) y eliminación.
* El formulario de envío permite escribir el mensaje con `{{variables}}` y, para el envío individual, elegir el cliente desde una **lista de clientes** (`GET /notificaciones/destinatarios`), sin escribir el ID a mano.

### Tablas implicadas

| Tabla | Operación | Motivo |
| --- | --- | --- |
| `notificacion_push` | CRUD | Persistencia de las notificaciones por destinatario |
| `usuario` | Lectura | Resolución de destinatarios y contexto de personalización |
| `bitacora` | Escritura | Auditoría de envíos y eliminaciones |

### Notas / trabajo futuro

* Es notificación **in-app**; el push real (FCM/APNs/Web Push) o la entrega en vivo (WebSocket) requieren tabla de *device tokens* y un proveedor externo, y quedan como evolución posterior.
* Posibles mejoras: envío por **segmentos** (nivel de cliente, ciudad) y plantillas predefinidas.
