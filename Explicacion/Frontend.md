Actúa como un Desarrollador Frontend Senior experto en React 18, TypeScript, Vite, Tailwind CSS y Zustand.

Necesito que construyas la **estructura base, el sistema de rutas y los Layouts principales** para una plataforma e-commerce moderna de ropa estilo SHEIN. Toda la implementación debe seguir estrictamente la arquitectura modular definida previamente.

---

### 1. ALCANCE Y REGLAS DE ARQUITECTURA
- **Patrón de capas:**
  - `src/core/`: HttpClient (Axios singleton con interceptores JWT), AuthContext, Zustand stores (`appStore`), websocket-client, providers globales.
  - `src/shared/`: Componentes UI atómicos reutilizables (`Button`, `Input`, `Modal`, `DataTable`, etc.) y Layouts globales.
  - `src/modules/`: Organizado por dominios (`acceso`, `inventario`, `comercial`, `electronico`, `operaciones`, `analitica`).
- **Separación Lógica-Vista:** Paginas complejas separadas en `Page.tsx/ts` (hooks, lógica, SWR/Fetch) y `Page.view.tsx` (JSX + Tailwind).
- **Alias de Importación:** Uso estricto de `@/` apuntando a `src/`.
- **Manejo de Estados Vacíos (Empty States):** Como el sistema inicia sin datos en la BD, la tienda pública y los módulos administrativos deben implementar componentes de `EmptyState` visualmente atractivos para cuando las listas/categorías/productos estén vacíos.

---

### 2. REQUERIMIENTOS DE LAYOUTS Y NAVEGACIÓN

#### A. Tienda Pública / Catálogo (`PublicLayout.tsx`)
1. **Top Bar Promocional:** Mensajes estilo "Envíos gratis", "Garantía de devolución".
2. **Header Principal:**
   - **Logo:** `FashionStore` (o marca del proyecto).
   - **Barra de Búsqueda Centrada:** Búsqueda dinámica de productos.
   - **Esquina Superior Derecha:** 
     - Acceso directo a "Iniciar Sesión / Registrarse" (abre Modal o redirige a `/login`).
     - Ícono de Carrito (contador dinámico mediante `CarritoContext`).
     - Selector de Tema (Claro/Oscuro).
3. **Barra de Navegación de Categorías (Header Inferior dinámico):**
   - Consume las categorías desde el backend mediante SWR (`CU08`).
   - Muestra las categorías dinámicamente (ej. *Ropa de Mujer, Tops, Temporadas, Accesorios*).
   - **Comportamiento si no hay datos:** Renderiza un esqueleto (`Skeleton`) o una lista por defecto vacía sin romper el diseño.
4. **Vista Principal (Landing / Catálogo - `CatalogoPage`):**
   - Banners promocionales/carrusel en la parte superior.
   - Grid dinámico de categorías e ítems.
   - Si no hay productos registrados, muestra una sección de bienvenida estilizada invitando al usuario a explorar o iniciar sesión como Administrador.

#### B. Panel Administrativo / Backoffice (`ProtectedLayout.tsx`)
1. **Control de Acceso:** Protegido por `AuthContext` y `ProtectedRoute`. Si no hay usuario autenticado o carece de permisos, redirige a `/login`.
2. **Sidebar Lateral (Dinámico según Permisos):**
   - Debe colapsar/desplegarse (guardando el estado en Zustand `appStore`).
   - Debe listar los paquetes de trabajo asociados a los Casos de Uso (CU) según los permisos del usuario (`hasPermission()`):
     - 🛡️ **Acceso y Seguridad:** Usuarios (`CU01`), Roles (`CU02`), Perfil (`CU03`), Bitácora (`CU20`).
     - 📦 **Catálogo e Inventario:** Productos (`CU09`), Categorías (`CU08`), Proveedores (`CU10`), Temporadas (`CU11`), Inventario/Almacén (`CU07`).
     - 💰 **Comercial y Tesorería:** Ventas Presenciales (`CU12`), Compras (`CU14`), Caja (`CU15`), Métodos de Pago (`CU16`).
     - 🛒 **E-Commerce Digital:** Carrito (`CU13`), Probador Virtual (`CU18`), Push (`CU19`).
     - 🏢 **Operaciones y Estructura:** Sucursales (`CU06`), Empleados (`CU05`), Clientes (`CU04`).
     - 📊 **Reportes y Analítica:** Dashboard (`CU21`), Reportes Generativos (`CU17`).
3. **Header Administrativo:** Muestra breadcrumbs, información del usuario autenticado, rol actual, botón para ir a la Tienda Pública y botón de Cerrar Sesión.

---

### 3. ESTRUCTURA DE ARCHIVOS A GENERAR

Genera los siguientes archivos base asegurando que estén completamente funcionales y tipados con TypeScript:

1. `src/App.tsx`: Configuración de proveedores (`SWRConfig`, `QueryProvider`, `ThemeProvider`, `AuthProvider`, `CarritoProvider`) y enrutamiento con `React Router`.
2. `src/shared/components/layout/PublicLayout.tsx`: Layout para la tienda cliente/catálogo público estilo SHEIN.
3. `src/shared/components/layout/ProtectedLayout.tsx`: Layout contenedor para el panel administrativo.
4. `src/shared/components/layout/Sidebar.tsx` & `SidebarView.tsx`: Sidebar modular filtrado por permisos de usuario.
5. `src/modules/acceso/pages/LoginPage/LoginPage.tsx`: Página de inicio de sesión universal (para Admin, Empleados o Clientes) con soporte para redirigir según el rol.
6. `src/modules/comercial/pages/CatalogoPage/CatalogoPage.tsx` y `CatalogoPage.view.tsx`: Vista inicial de la tienda con soporte para datos vacíos (`EmptyState`).

Escribe código limpio, production-ready y siguiendo las mejores prácticas de React + Tailwind CSS.