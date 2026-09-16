# Backend Explicación: Arquitectura de Paquetes en NestJS

El backend está estructurado como un **Monolito Modular** impulsado por NestJS, TypeScript, PostgreSQL y Prisma ORM. La arquitectura encapsula la lógica por dominios de negocio dentro de `src/modules/`, garantizando aislamiento, facilidades de mantenimiento y escalabilidad.

```text
backend/
├── node_modules/
├── test/
├── .env
├── .env.example
├── Dockerfile
├── nest-cli.json
├── package.json
└── src/
    ├── main.ts
    ├── app.module.ts
    │
    ├── config/
    │   └── configuration.ts
    │
    ├── database/
    │   ├── database.module.ts
    │   ├── database.config.ts
    │   └── seeders/
    │       └── initial.seeder.ts
    │
    ├── common/
    │   ├── decorators/
    │   │   ├── require-permission.decorator.ts
    │   │   └── current-user.decorator.ts
    │   ├── guards/
    │   │   ├── jwt-auth.guard.ts
    │   │   └── permissions.guard.ts
    │   ├── pipes/
    │   │   └── validation.pipe.ts
    │   ├── filters/
    │   │   └── all-exceptions.filter.ts
    │   ├── interceptors/
    │   │   ├── transform.interceptor.ts
    │   │   └── audit.interceptor.ts
    │   └── utils/
    │
    ├── providers/
    │   ├── redis.provider.ts
    │   └── storage.provider.ts
    │
    └── modules/
        ├── acceso/
        │   ├── acceso.module.ts
        │   ├── controllers/
        │   │   ├── auth.controller.ts            # CU01
        │   │   ├── usuarios.controller.ts        # CU02
        │   │   ├── roles.controller.ts           # CU03
        │   │   ├── clientes.controller.ts        # CU04
        │   │   ├── bitacora.controller.ts        # CU20
        │   │   └── perfil.controller.ts          # CU03 (Config Perfil)
        │   ├── services/
        │   │   ├── auth.service.ts
        │   │   ├── usuarios.service.ts
        │   │   ├── roles.service.ts
        │   │   ├── clientes.service.ts
        │   │   ├── bitacora.service.ts
        │   │   └── perfil.service.ts
        │   ├── repositories/
        │   │   ├── usuario.repository.ts
        │   │   ├── rol.repository.ts
        │   │   ├── cliente.repository.ts
        │   │   ├── sesion.repository.ts
        │   │   └── bitacora.repository.ts
        │   ├── entities/
        │   │   ├── usuario.entity.ts
        │   │   ├── rol.entity.ts
        │   │   ├── permiso.entity.ts
        │   │   ├── cliente.entity.ts
        │   │   ├── sesion.entity.ts
        │   │   └── bitacora.entity.ts
        │   ├── dto/
        │   │   ├── login.dto.ts
        │   │   ├── crear-usuario.dto.ts
        │   │   ├── actualizar-usuario.dto.ts
        │   │   ├── crear-rol.dto.ts
        │   │   ├── asignar-permiso.dto.ts
        │   │   ├── crear-cliente.dto.ts
        │   │   ├── actualizar-perfil.dto.ts
        │   │   └── cambiar-password.dto.ts
        │   └── mappers/
        │       ├── usuario.mapper.ts
        │       ├── cliente.mapper.ts
        │       └── bitacora.mapper.ts
        │
        ├── inventario/
        │   ├── inventario.module.ts
        │   ├── controllers/
        │   │   ├── categorias.controller.ts      # CU08
        │   │   ├── productos.controller.ts       # CU09
        │   │   ├── proveedores.controller.ts     # CU10
        │   │   └── temporadas.controller.ts      # CU11
        │   ├── services/
        │   │   ├── categorias.service.ts
        │   │   ├── productos.service.ts
        │   │   ├── proveedores.service.ts
        │   │   └── temporadas.service.ts
        │   ├── repositories/
        │   │   ├── categoria.repository.ts
        │   │   ├── producto.repository.ts
        │   │   ├── proveedor.repository.ts
        │   │   └── temporada.repository.ts
        │   ├── entities/
        │   │   ├── categoria.entity.ts
        │   │   ├── producto-base.entity.ts
        │   │   ├── producto-variante.entity.ts
        │   │   ├── producto-imagen.entity.ts
        │   │   ├── proveedor.entity.ts
        │   │   └── temporada.entity.ts
        │   ├── dto/
        │   │   ├── crear-categoria.dto.ts
        │   │   ├── crear-producto.dto.ts
        │   │   ├── actualizar-producto.dto.ts
        │   │   ├── crear-variante.dto.ts
        │   │   ├── crear-proveedor.dto.ts
        │   │   └── crear-temporada.dto.ts
        │   └── mappers/
        │       ├── categoria.mapper.ts
        │       ├── producto.mapper.ts
        │       └── proveedor.mapper.ts
        │
        ├── operaciones/
        │   ├── operaciones.module.ts
        │   ├── controllers/
        │   │   ├── sucursales.controller.ts     # CU06
        │   │   ├── empleados.controller.ts      # CU26
        │   │   ├── sectores.controller.ts       # CU27
        │   │   └── mesas.controller.ts          # CU28
        │   ├── services/
        │   │   ├── sucursales.service.ts
        │   │   ├── empleados.service.ts
        │   │   ├── sectores.service.ts
        │   │   └── mesas.service.ts
        │   ├── repositories/
        │   │   ├── sucursal.repository.ts
        │   │   ├── empleado.repository.ts
        │   │   ├── sector.repository.ts
        │   │   └── mesa.repository.ts
        │   ├── entities/
        │   │   ├── sucursal.entity.ts
        │   │   ├── empleado.entity.ts
        │   │   ├── empleado-sucursal.entity.ts
        │   │   ├── sector.entity.ts
        │   │   └── mesa.entity.ts
        │   ├── dto/
        │   │   ├── crear-sucursal.dto.ts
        │   │   ├── crear-empleado.dto.ts
        │   │   ├── reasignar-sucursal.dto.ts
        │   │   ├── crear-sector.dto.ts
        │   │   └── crear-mesa.dto.ts
        │   └── mappers/
        │       ├── sucursal.mapper.ts
        │       ├── empleado.mapper.ts
        │       └── mesa.mapper.ts
        │
        ├── comercial/                            # Ciclos posteriores (Ventas, Compras, Caja)
        │   └── comercial.module.ts
        │
        └── electronico/                          # Ciclos posteriores (E-commerce, Carrito, Pagos)
            └── electronico.module.ts
```

### Capas Internas de un Módulo en NestJS

Cada módulo de dominio contiene una estructura uniforme por capas:

* **`*.controller.ts`:** Expone los endpoints REST, recibe las peticiones, mapea parámetros y delega la ejecución al servicio. Protegido mediante `@UseGuards(JwtAuthGuard, PermissionsGuard)`.
* **`*.service.ts`:** Contiene la **lógica de negocio pura**, manejo de reglas transaccionales (`prisma.$transaction`) y aplicación de transformaciones de datos.
* **`*.repository.ts`:** Encapsula las operaciones del ORM sobre PostgreSQL, aislando las consultas complejas de los servicios.
* **`dto/`:** Objetos de Transferencia de Datos estrictamente validados mediante `class-validator` y `class-transformer` (`create-x.dto.ts`, `update-x.dto.ts`, `x-response.dto.ts`).
* **`entities/` / Prisma Schema:** Definición de modelos de base de datos y mapeo de tipos.
* **`*.mapper.ts`:** Convierte entidades del ORM a DTOs de respuesta para evitar la exposición de campos sensibles (como `password_hash`).

### Flujo de Una Petición Backend

1. **HTTP Request** $\rightarrow$ Interceptado por **`JwtAuthGuard`** (valida el Bearer token JWT).
2. **`PermissionsGuard`** $\rightarrow$ Evalúa los permisos del usuario contra el decorador `@RequirePermission()`.
3. **`ValidationPipe`** $\rightarrow$ Valida y transforma la estructura del JSON según el `DTO`.
4. **`Controller`** $\rightarrow$ Llama al `Service` del módulo correspondiente.
5. **`Service`** $\rightarrow$ Ejecuta reglas de negocio, persiste mediante `Repository`/`Prisma` y registra la acción a través del `AuditInterceptor` en `log_auditoria`.
6. **`ResponseMapper`** $\rightarrow$ Retorna un JSON normalizado al frontend.

---

# Frontend Explicación: Arquitectura Modular React + Tailwind CSS

El frontend utiliza React 18, TypeScript, Vite, Tailwind CSS y SWR, siguiendo el patrón **Container-View / Headless Component** sobre una estructura modular de archivos (`src/modules/`).

```text
src/
├── core/                       # Núcleo de la aplicación
│   ├── config/                 # Constantes de entorno y endpoints
│   ├── context/                # AuthContext, CarritoContext
│   ├── http/                   # HttpClient Singleton (Axios con interceptores de JWT)
│   └── store/                  # Zustand appStore (Estado global de UI, tema, sidebar)
├── shared/                     # Componentes y elementos reutilizables
│   ├── components/
│   │   ├── layout/             # PublicLayout (SHEIN Style), ProtectedLayout, Sidebar
│   │   └── ui/                 # Button, Input, Modal, DataTable, EmptyState, Skeleton
│   └── utils/                  # Formateadores de moneda, fechas y validadores
└── modules/                    # Módulos Funcionales por Dominio
    ├── acceso/                 # Páginas de Login, Registro, Usuarios, Roles, Bitácora
    ├── inventario/             # Páginas de Categorías, Productos, Proveedores, Temporadas
    └── operaciones/            # Páginas de Sucursales, Empleados, Sectores, Mesas

```

### Principios Fundamentales del Frontend

1. **Dos Vistas Principales (Layouts):**
* **`PublicLayout.tsx` (E-Commerce Público estilo SHEIN):** Header promocional, barra de búsqueda central, categorías dinámicas cargadas desde el backend (`CU08`), carrito dinámico y botón superior derecho para "Iniciar Sesión / Registrarse". Incluye componentes `EmptyState` y `Skeleton` mientras no existan productos cargados.
* **`ProtectedLayout.tsx` (Panel Administrativo / Backoffice):** Protegido por `AuthContext`. Incluye un `Sidebar` retráctil cuyos accesos a los módulos se filtran dinámicamente mediante la función `hasPermission()`.


2. **Separación Lógica-Vista (Headless):**
* **`Page.tsx` (Lógica):** Maneja hooks de React, fetching con `SWR`, mutate, llamadas al `HttpClient` y controladores de eventos.
* **`Page.view.tsx` (Vista):** Renderiza exclusivamente JSX, Tailwind CSS, modales y tablas visuales.


3. **Mapeo Limpio e Imports con `@/`:** Todo recurso interno se importa utilizando el alias `@/` apuntando a `src/`.

---

# Especificación Detallada de Funcionalidades - Ciclo #1

---

## CU01 – Gestionar Sesión

**Actor:** Todos los Actores Autenticados (A, ES, VC, EI, EC, C)

**Prioridad:** Alta

### Descripción funcional

Permite a cualquier actor autenticarse en el sistema mediante un **Portal Único** (`/login`). Tras la autenticación exitosa, el sistema evalúa el campo `tipo_usuario` (A, E, C) y redirige al usuario a su área correspondiente.

**Reglas de Redirección e Identidad:**

* **Administrador / Superusuario (A):** Acceso total al Panel Administrativo Global. No requiere vinculación con tablas de extensión operativas.
* **Empleado (E - ES, VC, EI, EC):** Requiere un registro activo en `empleado` y una sucursal asignada en `empleado_sucursal`. Redirige al Backoffice (`/admin/dashboard`).
* **Cliente (C):** Requiere registro en la tabla `cliente`. Redirige al catálogo público / E-commerce (`/`).

### Flujo principal

1. **Login:**
* El cliente envía `username` (o `email`) y `password` a `POST /api/acceso/auth/login`.
* El backend busca la entidad `Usuario`, valida `activo = TRUE` y `estado_acceso = 'HABILITADO'`.
* Compara la contraseña mediante `bcrypt`. Si falla, incrementa `intentos_fallidos`.
* Si alcanza el límite máximo de intentos (ej. 5), cambia `estado_acceso = 'BLOQUEADO'` y retorna error `423 Locked`.
* Si la clave es válida: reinicia `intentos_fallidos = 0`, genera un `accessToken` (JWT con permisos/roles) y un `refreshToken`.
* Consulta el `tipo_usuario`: si es `'E'`, extrae la sucursal activa desde `empleado_sucursal`.
* Registra el inicio de sesión en `sesion` y retorna tokens + perfil de contexto.


2. **Validar Sesión (`GET /api/acceso/auth/me`):**
* El frontend transmite el token en el Header `Authorization: Bearer <token>`. El `JwtAuthGuard` valida la vigencia del token y retorna el perfil extendido con permisos.


3. **Refrescar Token (`POST /api/acceso/auth/refresh`):**
* Envía el `refreshToken`. Si la sesión en la BD no tiene `fecha_cierre`, invalida el anterior y retorna un nuevo par de tokens.


4. **Logout (`POST /api/acceso/auth/logout`):**
* Actualiza el registro de `sesion` estableciendo `fecha_cierre = NOW()`. Invalida los tokens en el cliente.



### Tablas implicadas

| Tabla | Operación | Motivo |
| --- | --- | --- |
| `usuario` | Lectura y Escritura | Verificación de credenciales, bloqueo de cuenta |
| `empleado` | Lectura | Obtención de legajo si `tipo_usuario = 'E'` |
| `cliente` | Lectura | Obtención de perfil de consumidor si `tipo_usuario = 'C'` |
| `empleado_sucursal` | Lectura | Carga del contexto de sucursal activa |
| `sesion` | CRUD | Registro histórico de inicios/cierres de sesión |

---

## CU02 – Gestionar Usuarios

**Actor:** Administrador (A)

**Prioridad:** Alta

### Descripción funcional

El Administrador gestiona las cuentas de acceso al sistema, asignando la identidad (`tipo_usuario`) y vinculando los roles del sistema.

### Flujo principal

1. **Listar Usuarios (`GET /api/acceso/usuarios`):**
* Devuelve un listado paginado con filtros por búsqueda de texto (`nombre`, `ci`, `username`), `tipo_usuario` y `estado_acceso`.


2. **Crear Usuario (`POST /api/acceso/usuarios`):**
* Pide: CI, nombre, apellido, username, email, teléfono, sexo, contraseña inicial y `tipo_usuario` (`'A'`, `'E'`, `'C'`).
* Encripta la contraseña usando `bcrypt`.
* Inserta en la tabla `usuario` con `activo = TRUE` y `estado_acceso = 'HABILITADO'`.
* Si se especifican roles, crea los registros correspondientes en `rol_usuario`.


3. **Editar Usuario (`PUT /api/acceso/usuarios/:id`):**
* Permite actualizar datos personales, `tipo_usuario`, restablecer contraseñas y modificar el estado (`HABILITADO`, `SUSPENDIDO`).


4. **Asignar/Remover Roles (`POST /api/acceso/usuarios/:id/roles`):**
* Inserta o desactiva las relaciones en `rol_usuario`.


5. **Eliminación Lógica (`DELETE /api/acceso/usuarios/:id`):**
* Actualiza `activo = FALSE`. La cuenta se deshabilita sin perder integridad referencial en la base de datos.



### Tablas implicadas

| Tabla | Operación | Motivo |
| --- | --- | --- |
| `usuario` | CRUD | Entidad principal de usuarios |
| `rol` | Lectura | Consulta de roles asignables |
| `rol_usuario` | CRUD | Asociación de roles a cada usuario |
| `sesion` | Escritura | Cierre forzado de sesiones al suspender cuentas |

---

## CU03 – Gestionar Roles y Permisos

**Actor:** Administrador (A)

**Prioridad:** Alta

### Descripción funcional

Permite definir los roles del sistema (ej. "Administrador de Sucursal", "Encargado de Inventario", "Vendedor") y asignar exactamente la matriz de permisos por cada módulo.

### Flujo principal

1. **Listar Roles (`GET /api/acceso/roles`):**
* Retorna los roles registrados con su descripción y cantidad de usuarios asociados.


2. **Crear/Editar Rol (`POST` / `PUT /api/acceso/roles`):**
* Registra `nombre` (único), `descripcion` y `nivel_acceso`.


3. **Gestionar Matriz de Permisos (`POST /api/acceso/roles/:id/permisos`):**
* Carga el catálogo completo de la tabla `permiso` agrupado por módulo.
* Mapea y guarda en `rol_permiso` las asociaciones activas.
* El `PermissionsGuard` del backend utilizará esta tabla para autorizar/rechazar endpoints.



### Tablas implicadas

| Tabla | Operación | Motivo |
| --- | --- | --- |
| `rol` | CRUD | Definición de roles de acceso |
| `permiso` | Lectura | Catálogo global de permisos disponibles |
| `rol_permiso` | CRUD | Matriz de asignación de permisos por rol |

---

## CU04 – Gestionar Clientes

**Actor:** Administrador (A), Vendedor Comercial (VC)

**Prioridad:** Media

### Descripción funcional

Permite gestionar la información de los clientes registrados o ingresar nuevos clientes en ventanilla para procesos de facturación e historial comercial.

### Flujo principal

1. **Listar Clientes (`GET /api/acceso/clientes`):**
* Búsqueda por CI/NIT, nombre, correo o nivel de cliente.


2. **Crear Cliente (`POST /api/acceso/clientes`):**
* Registra los datos de `usuario` (con `tipo_usuario = 'C'`).
* Crea automáticamente el registro en la tabla `cliente` asociado al `id_usuario`, inicializando `puntos_fidelidad = 0` y `nivel_cliente = 'REGULAR'`.
* Registra campos opcionales como `nit` y `razon_social` para facturación.


3. **Editar Cliente (`PUT /api/acceso/clientes/:id`):**
* Actualiza datos personales, dirección de envío predeterminada o NIT.



### Tablas implicadas

| Tabla | Operación | Motivo |
| --- | --- | --- |
| `usuario` | CRUD | Cuenta base del cliente |
| `cliente` | CRUD | Información extendida (puntos, NIT, nivel) |

---

## CU05 – Gestionar Empleados

**Actor:** Administrador (A)

**Prioridad:** Alta

### Descripción funcional

Gestiona la información laboral del personal de la empresa y su vinculación operativa con las sucursales.

### Flujo principal

1. **Listar Empleados (`GET /api/operaciones/empleados`):**
* Retorna la lista de empleados. Filtra por sucursal, cargo, turno y estado laboral.


2. **Crear Empleado (`POST /api/operaciones/empleados`):**
* Reutiliza de forma transaccional la creación de `usuario` (`tipo_usuario = 'E'`).
* Registra en la tabla `empleado`: `codigo_legajo`, `cargo`, `salario`, `fecha_contratacion`.
* Crea el registro inicial en `empleado_sucursal` vinculando al empleado con la sucursal asignada.


3. **Editar Empleado / Reasignar Sucursal (`PUT /api/operaciones/empleados/:id`):**
* Modifica salario, cargo o turno.
* Si cambia de sucursal, cierra el registro previo en `empleado_sucursal` (`fecha_fin = NOW()`) y crea la nueva asignación.



### Tablas implicadas

| Tabla | Operación | Motivo |
| --- | --- | --- |
| `usuario` | CRUD | Cuenta de acceso del empleado |
| `empleado` | CRUD | Datos laborales de la empresa |
| `empleado_sucursal` | CRUD | Asignación histórica a sucursales |
| `sucursal` | Lectura | Consulta de sucursales disponibles |

---

## CU06 – Gestionar Sucursales y Ubicación

**Actor:** Administrador (A)

**Prioridad:** Alta

### Descripción funcional

Administra las sedes físicas o almacenes operativos del sistema. La sucursal es el pivote central para la gestión del inventario, ventas y asignación de personal.

### Flujo principal

1. **Listar Sucursales (`GET /api/operaciones/sucursales`):**
* Retorna todas las sucursales con dirección, teléfono, estado y cantidad de áreas.


2. **Crear Sucursal (`POST /api/operaciones/sucursales`):**
* Registra: `nombre`, `direccion`, `telefono`, `ciudad`, `coordenadas_gps` y `es_central` (booleano).


3. **Editar Sucursal (`PUT /api/operaciones/sucursales/:id`):**
* Actualiza datos de contacto, horarios de atención o deshabilita la sucursal (`activo = FALSE`).



### Tablas implicadas

| Tabla | Operación | Motivo |
| --- | --- | --- |
| `sucursal` | CRUD | Catálogo de sedes físicas y almacenes |

---

## CU08 – Gestionar Categorías

**Actor:** Administrador (A)

**Prioridad:** Baja

### Descripción funcional

Gestiona la taxonomía jerárquica del catálogo de productos (ej. *Mujer -> Ropa -> Tops*). Permite alimentar la barra superior dinámica del E-commerce público.

### Flujo principal

1. **Listar Categorías (`GET /api/inventario/categorias`):**
* Devuelve las categorías estructuradas en forma de árbol (usando `categoria_padre_id`).


2. **Crear Categoría (`POST /api/inventario/categorias`):**
* Recibe `nombre`, `slug` (para URLs), `descripcion`, `imagen_url` y `categoria_padre_id` (opcional).


3. **Editar/Desactivar Categoría (`PUT /api/inventario/categorias/:id`):**
* Actualiza los datos o desactiva la categoría, ocultándola del catálogo público.



### Tablas implicadas

| Tabla | Operación | Motivo |
| --- | --- | --- |
| `categoria` | CRUD | Clasificación jerárquica de productos |

---

## CU09 – Gestionar Productos y Variantes

**Actor:** Administrador (A), Encargado de Stock (ES)

**Prioridad:** Alta

### Descripción funcional

Administra el catálogo maestro de artículos comercializables, contemplando sus imágenes, especificaciones y combinaciones de variantes (Talla, Color, Material).

### Flujo principal

1. **Listar Productos (`GET /api/inventario/productos`):**
* Retorna el catálogo con filtros por categoría, marca, temporada o texto de búsqueda.


2. **Crear Producto y Variantes (`POST /api/inventario/productos`):**
* Registra la cabecera en `producto_base`: `codigo_sku_padre`, `nombre`, `descripcion`, `precio_base`, `categoria_id`, `temporada_id`.
* Inserta la galería de imágenes en `producto_imagen`.
* Genera las variantes asociadas en `producto_variante`: `sku_variante`, `talla`, `color`, `precio_adicional`, `imagen_especifica_url`.


3. **Editar Producto (`PUT /api/inventario/productos/:id`):**
* Modifica especificaciones, precios o actualiza variantes existentes.



### Tablas implicadas

| Tabla | Operación | Motivo |
| --- | --- | --- |
| `producto_base` | CRUD | Cabecera general del producto |
| `producto_variante` | CRUD | Combinaciones específicas (SKU, Talla, Color) |
| `producto_imagen` | CRUD | Galería multimedia del producto |
| `categoria` | Lectura | Vinculación jerárquica |
| `temporada` | Lectura | Asociación a colecciones de moda |

---

## CU10 – Gestionar Proveedores

**Actor:** Administrador (A), Encargado de Compras (EC)

**Prioridad:** Media

### Descripción funcional

Mantiene el registro de empresas proveedoras de insumos o mercadería terminada para la generación de órdenes de compra.

### Flujo principal

1. **Listar Proveedores (`GET /api/inventario/proveedores`):**
* Muestra la lista de proveedores con filtros por NIT, Razón Social o Nombre de Contacto.


2. **Crear Proveedor (`POST /api/inventario/proveedores`):**
* Registra `razon_social`, `nit`, `contacto_nombre`, `telefono`, `email`, `direccion`.


3. **Editar/Desactivar Proveedor (`PUT /api/inventario/proveedores/:id`):**
* Modifica información corporativa o cambia el estado a inactivo.



### Tablas implicadas

| Tabla | Operación | Motivo |
| --- | --- | --- |
| `proveedor` | CRUD | Registro maestro de empresas proveedoras |

---

## CU11 – Gestionar Temporadas

**Actor:** Administrador (A)

**Prioridad:** Baja

### Descripción funcional

Permite agrupar productos en colecciones o temporadas comerciales específicas (ej. *Verano 2026*, *Otoño/Invierno*, *Black Friday*).

### Flujo principal

1. **Listar Temporadas (`GET /api/inventario/temporadas`):**
* Muestra las colecciones registradas y sus rangos de fechas de vigencia.


2. **Crear Temporada (`POST /api/inventario/temporadas`):**
* Campos: `nombre`, `codigo`, `fecha_inicio`, `fecha_fin`, `activo`.


3. **Asociar a Productos:**
* La temporada queda disponible para ser vinculada en el `CU09` (Productos).



### Tablas implicadas

| Tabla | Operación | Motivo |
| --- | --- | --- |
| `temporada` | CRUD | Colecciones comerciales de productos |

---

## CU20 – Gestionar Bitácora (Auditoría)

**Actor:** Administrador (A)

**Prioridad:** Alta

### Descripción funcional

Proporciona la trazabilidad completa del sistema mediante la consulta de logs de auditoría técnica y funcional generados por cualquier operación de modificación de datos (`INSERT`, `UPDATE`, `DELETE`).

### Flujo principal

1. **Consultar Logs (`GET /api/acceso/bitacora`):**
* Permite filtrar por `usuario_id`, `tabla_afectada`, `operacion` y rango de fechas (`fecha_desde`, `fecha_hasta`).


2. **Ver Detalle de Auditoría (`GET /api/acceso/bitacora/:id`):**
* Retorna un modal detallado mostrando la comparación estructurada de los objetos JSONB: `datos_anteriores` vs `datos_nuevos`, además de la dirección IP y el Agente de Usuario (Browser) desde donde se ejecutó la acción.



### Tablas implicadas

| Tabla | Operación | Motivo |
| --- | --- | --- |
| `log_auditoria` | Lectura | Registro histórico de auditoría de BD |
| `usuario` | Lectura | Identificación del usuario responsable |

---

## CU03 (Configurar Perfil Personal)

**Actor:** Todos los Actores Autenticados (A, ES, VC, EI, EC, C)

**Prioridad:** Baja

### Descripción funcional

Permite a cualquier usuario autenticado consultar y actualizar su información básica de perfil y cambiar su clave de acceso.

### Flujo principal

1. **Ver Perfil (`GET /api/acceso/perfil`):**
* Carga la información propia extraída de `usuario` y su tabla de extensión (`empleado` o `cliente`).


2. **Editar Perfil (`PUT /api/acceso/perfil`):**
* Permite modificar `nombre`, `apellido`, `telefono`, `direccion` y `foto_perfil_url`. No permite alterar el CI ni el `username`.


3. **Cambiar Contraseña (`PATCH /api/acceso/perfil/cambiar-password`):**
* Exige la `password_actual`, valida su concordancia mediante `bcrypt` y actualiza con la `nueva_password` encriptada.



### Tablas implicadas

| Tabla | Operación | Motivo |
| --- | --- | --- |
| `usuario` | Lectura y Escritura | Actualización de datos propios y clave |
| `empleado` / `cliente` | Lectura y Escritura | Modificación de información extendida |