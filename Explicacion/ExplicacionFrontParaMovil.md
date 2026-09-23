Esta es la estructura del frontend que necesita un cliente, antes y después de iniciar sesión, sin nada de administración. La calculé siguiendo los imports reales de cada pantalla del cliente, así que no depende de mi memoria. Incluye lo nuevo del front: la sucursal elegida por el cliente (CU08), las reservas con anticipo en línea (CU23), el probador virtual con cámara (CU19) y la campana de notificaciones propias.

**Flujo de la vista cliente**

Entrar → **Catálogo** (lo único que carga sin sesión, junto con login/registro): primero se elige la **sucursal** en la barra de categorías (CU08) porque de ahí sale el stock real en todas las pantallas siguientes. Al abrir un producto se ven tallas/colores con stock de esa sucursal, se **agrega al carrito**, se **reserva** (CU23, con anticipo del 20% pagado en línea en el siguiente paso) o se **prueba la prenda** en el probador virtual (CU19). Para carrito, checkout, reservas y "Mi cuenta" hace falta **iniciar sesión** (si el visitante toca resolverlo solo, se le pide login). El pago puede ser **QR, PayPal o tarjeta**; al terminar sale la confirmación y todo queda listado en **Mi cuenta** (perfil, reservas, compras, devoluciones), con la campana de notificaciones activa de forma permanente en la barra superior.

**Estructura (`frontend/src/`)**

```
src/
├── main.tsx
├── App.tsx                      ← rutas del público + /mi-cuenta (todo el admin vive aparte en /admin)
├── index.css
│
├── core/
│   ├── config/env.ts            ← VITE_API_URL, VITE_APP_NAME
│   ├── context/AuthContext.tsx  ← revalida la sesión guardada al abrir la app (GET /acceso/auth/me)
│   ├── http/{envelope,errors,httpClient}.ts   ← axios + token + errores
│   ├── providers/ThemeProvider.tsx
│   └── store/
│       ├── authStore.ts         ← token + perfil + permisos (persistido en "fashionstore-auth")
│       ├── appStore.ts          ← del cliente solo sirve el tema (el resto es del panel admin)
│       └── tiendaStore.ts       ← sucursal del cliente (CU08), persistida en "fashionstore-tienda";
│                                 la comparten catálogo → ficha → carrito → checkout → reserva
│
├── shared/
│   ├── components/
│   │   ├── layout/PublicLayout.tsx            ← header (buscador, usuario, campana, carrito, tema)
│   │   │                                        + CategoryNavBar + menú lateral + pie
│   │   └── ui/{Badge,Button,CartIcon,EmptyState,Input,Modal,Pagination,Select,Skeleton,ThemeToggle}.tsx
│   └── utils/seleccionProducto.ts             ← selección de prendas por producto (7 días de vigencia)
│
└── modules/
    ├── acceso/                                 ← login, registro, perfil
    │   ├── api/{auth.api,index}.ts
    │   ├── components/{CambiarPasswordForm,PerfilForm}.tsx
    │   ├── hooks/useCerrarSesion.ts            ← revoca refresh token, limpia estado, selecciones y caché
    │   ├── pages/{LoginPage,RegistroPage,PerfilPage}/...
    │   ├── services/perfil.service.ts
    │   └── types.ts
    │
    ├── inventario/                             ← solo lo del catálogo público
    │   ├── api/{categorias.api,productos.api,index}.ts
    │   ├── hooks/{useCategorias,useProductos,index}.ts
    │   └── types.ts
    │
    ├── comercial/                              ← solo para Mis compras / Mis devoluciones
    │   ├── components/{VentaDetalle,DevolucionDetalle}.tsx
    │   └── types.ts
    │
    └── electronico/                            ← la tienda completa
        ├── api/{tienda,producto,carrito,reservas,checkout,cuenta,probador,index}.api.ts
        ├── components/
        │   ├── CategoryNavBar.tsx              ← píldoras "Todas/categorías/temporada vigente" + selector
        │   │                                      de sucursal (CU08); reemplaza al acordeón del sidebar
        │   ├── GaleriaProducto.tsx   NotificationBell.tsx   OfertasCarrusel.tsx
        │   ├── ProbadorVirtual.tsx   ProductoCard.tsx   ReservaEstadoBadge.tsx
        │   ├── SelectorCantidad.tsx   StoreFooter.tsx   StoreLogo.tsx   StoreSidebar.tsx
        ├── hooks/{useCarrito,useMisReservas,useProbadorVariante,useProductoDetalle,
        │          useSucursalActiva,useSucursalesPublicas,useTemporadasPublicas,index}.ts
        ├── pages/
        │   ├── CatalogoPage/{CatalogoPage,CatalogoPage.view}.tsx
        │   ├── ProductoPage/{ProductoPage,ProductoPage.view}.tsx
        │   ├── CarritoPage/{CarritoPage,CarritoPage.view}.tsx
        │   ├── CheckoutPage/{CheckoutPage,CheckoutPage.view,CheckoutResultadoPages,PaypalRetornoPage}.tsx
        │   ├── MiCuentaPage/CuentaLayout.tsx
        │   ├── MisReservasPage/   MisComprasPage/   MisDevolucionesPage/ (con .view)
        ├── services/notificaciones.service.ts  ← solo las funciones "mias" (ver "Lo que NO hay que llevar")
        ├── utils/{probador-ar.ts,reservas.ts}   ← anclaje AR del probador y helpers de reservas/fechas
        └── types.ts
```

**Pantallas y rutas del cliente**

| Ruta | Pantalla | Cuándo |
|---|---|---|
| `/` | Catálogo: carrusel de Ofertas (solo en "Todas"), píldoras por categoría/temporada, búsqueda y selector de sucursal | siempre |
| `/producto/:id` | Ficha: galería, tallas/colores con stock de la sucursal elegida, Agregar, Reservar, Comprar ahora, Probador virtual y relacionados | siempre |
| `/login`, `/registro` | Iniciar sesión y crear cuenta | sin sesión |
| `/carrito` | Carrito (necesita sesión de cliente) | con sesión |
| `/checkout` | Pago del carrito con QR, PayPal o tarjeta | con sesión |
| `/checkout/reserva/:id` | Pago del anticipo (20%) de una reserva | con sesión |
| `/checkout/paypal/retorno`, `/checkout/paypal/cancelado`, `/checkout/exito` | Resultados del pago | con sesión |
| `/mi-cuenta` | Perfil (datos personales y cambiar contraseña) | con sesión |
| `/mi-cuenta/reservas`, `/mi-cuenta/compras`, `/mi-cuenta/devoluciones` | Mis reservas, compras y devoluciones | con sesión |
| `/mis-reservas` | Redirige a `/mi-cuenta/reservas` | — |
| `/categoria/:slug` | Placeholder "en construcción" | — |

En la barra superior: sin sesión se ve el logo y "Iniciar sesión / Registrarse"; con sesión, "Hola, {nombre}" y el botón ☰ que abre el menú lateral. La campana de notificaciones (propias) consulta el contador cada 30 s. El menú lateral cambia: un **cliente** ve "Mi cuenta" (perfil/reservas/compras/devoluciones); un **visitante** ve Temporadas y Contáctanos.

**Lo que NO hay que llevar**
- Todo el panel de administración: `ProtectedLayout`, `Sidebar`, `SidebarView`, `PermissionRoute`, `ComingSoonPage` (excepto el placeholder de `/categoria/:slug`) y las carpetas `operaciones/` y `reporte/`.
- Dentro de `acceso/`: `services/{roles,usuarios,bitacora}.service.ts`, `PermisosMatrix`, `RolForm`, `UsuarioForm` y las páginas `BitacoraPage`, `RolesPage`, `UsuariosPage`. `PerfilPage.view` importa de `usuarios.service.ts` solo la constante `TIPO_USUARIO_LABEL`; muévela y no la necesitas.
- Dentro de `inventario/`: todos los formularios, páginas y services de gestión (ProductoForm, CategoriaForm, StockPage, etc.). Ojo: `CatalogoPage` usa `buscarCategoriaPorId()` de `services/categorias.service.ts` — es una función helper, inclúyela sola.
- Dentro de `electronico/`: `ventasEnLinea.api.ts`, `NotificacionForm`, `ReservaDetalle`, `ReservaForm`, la sección admin del probador (`ProbadorAdminPage`, `listarVariantesProbador`/`subirModeloProbador`/`quitarModeloProbador` de `probador.api.ts`) y las pantallas `ReservasPage`, `VentasEnLineaPage`, `NotificacionesPage`. El visor `Modelo3D` y `Modelo3DView` (three-utils) son del panel; el cliente solo usa `ProbadorVirtual` + `utils/probador-ar.ts` + `fetchProbadorVariante`.
- Dentro de `comercial/`: todo lo de gestión (CajaPage, VentasPage, ComprasPage, PasarelasPage, sus forms y services). Solo hacen falta `VentaDetalle`, `DevolucionDetalle` y `types.ts`.
- `reservas.api.ts` y `notificaciones.service.ts` mezclan funciones del cliente y del personal. Del primero solo sirven `fetchMisReservas`, `fetchMiReserva`, `crearMiReserva` y `cancelarMiReserva`. Del segundo, solo `listarMias`, `contarNoLeidas`, `marcarLeida` y `marcarTodasLeidas`.
- De `appStore` solo el tema (`toggleTheme`/`theme`); `sidebarCollapsed`, `gruposAbiertos` y `sucursalActivaId` son del panel. La sucursal del cliente vive en `tiendaStore`.

**Endpoints que usa el cliente (`VITE_API_URL`, por defecto `http://localhost:3000/api`)**
- **Sesión:** `POST /acceso/auth/{login,registro,refresh,logout}`, `GET /acceso/auth/me`, `GET|PUT /acceso/perfil`, `PATCH /acceso/perfil/cambiar-password`.
- **Catálogo (públicos):** `GET /inventario/categorias`, `GET /inventario/productos` (params `idCategoria`, `idTemporada`, `idSucursal`, `soloOfertas`, `search`), `GET /inventario/productos/:id/{publico,relacionados}`, `GET /inventario/temporadas/publicas`, `GET /operaciones/sucursales/publicas`.
- **Carrito:** `GET|DELETE /electronico/carrito`, `POST|PATCH|DELETE /electronico/carrito/items[/:id]`.
- **Reservas (cliente):** `GET|POST /electronico/reservas/mias`, `GET /electronico/reservas/mias/:id`, `POST /electronico/reservas/mias/:id/cancelar`.
- **Pago:** `GET /electronico/checkout/metodos`, y `POST /electronico/checkout/{paypal/orden,paypal/capturar,qr,qr/confirmar,tarjeta}`. Para el anticipo de una reserva, las mismas rutas bajo `/electronico/checkout/reservas/:id/...`. PayPal redirige el navegador y vuelve a `/checkout/paypal/retorno?token=...` (con `&reserva=ID` si era anticipo).
- **Probador virtual (CU19):** `GET /electronico/probador/variante/:id` (devuelve el `.glb` de la variante y la zona del cuerpo).
- **Mi cuenta:** `GET /comercial/mi-cuenta/{compras,devoluciones}[/:id]` con `?page=&limit=` (10 por página).
- **Notificaciones propias:** `GET /electronico/notificaciones/mias`, `GET /electronico/notificaciones/mias/no-leidas`, `PATCH /electronico/notificaciones/mias/:id/leido`, `PATCH /electronico/notificaciones/mias/leer-todas`.

Todas las respuestas vienen envueltas en `{ data, timestamp }`, como se ve en `core/http/envelope.ts`.

**Cuatro cosas que cambian al llevarlo a móvil**
1. **PayPal:** hoy redirige el navegador a PayPal y vuelve a `FRONTEND_URL/checkout/paypal/retorno`. En móvil necesitarás un enlace profundo o un WebView (para reservas, recuerda que el retorno puede traer `?reserva=ID`), y apuntar `FRONTEND_URL` del backend a eso.
2. **Almacenamiento:** `authStore` (solo guarda el token y el perfil), `tiendaStore` (sucursal activa) y `seleccionProducto.ts` usan `localStorage`, además del toggle de tema de `appStore`. Hay que cambiarlos por el almacenamiento del dispositivo.
3. **Librería del QR:** el checkout usa `qrcode.react`, que es solo web. En móvil habría que reemplazarla (o apuntar al mismo código QR, pero generándolo con la librería de la plataforma).
4. **Probador virtual (CU19):** el cliente abre la cámara (`getUserMedia`) y sobre el video corre MediaPipe (`tasks-vision`, WASM en `/mediapipe/wasm` + modelo `pose_landmarker_lite`) más una escena `three.js` (WebGL) que superpone el `.glb` de la variante sobre el torso. No se puede portar a un WebView puro: necesita módulo de cámara y render 3D/AR nativo de la plataforma.

Si me dices con qué tecnología harás la versión móvil (React Native, Expo, Flutter u otra), te preparo el mapa exacto de qué archivo se convierte en qué.