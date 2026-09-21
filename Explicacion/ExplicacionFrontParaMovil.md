Esta es la estructura del frontend que necesita un cliente, antes y después de iniciar sesión, sin nada de administración. La calculé siguiendo los imports reales de cada pantalla del cliente, así que no depende de mi memoria.

**Estructura (`frontend/src/`)**

```
src/
├── main.tsx
├── App.tsx                      ← solo las rutas del cliente (ver tabla abajo)
├── index.css
│
├── core/
│   ├── config/env.ts            ← VITE_API_URL, VITE_APP_NAME
│   ├── context/AuthContext.tsx  ← revalida la sesión guardada al abrir la app
│   ├── http/{envelope,errors,httpClient}.ts   ← axios + token + errores
│   ├── providers/ThemeProvider.tsx
│   └── store/{appStore,authStore}.ts          ← de appStore solo sirve el tema
│
├── shared/
│   ├── components/
│   │   ├── layout/PublicLayout.tsx            ← barra superior + menú + pie
│   │   └── ui/{Badge,Button,CartIcon,EmptyState,Input,Modal,Pagination,Select,Skeleton,ThemeToggle}.tsx
│   └── utils/seleccionProducto.ts             ← selección de prendas guardada
│
└── modules/
    ├── acceso/                                 ← login, registro, perfil
    │   ├── api/{auth.api,index}.ts
    │   ├── components/{CambiarPasswordForm,PerfilForm}.tsx
    │   ├── hooks/useCerrarSesion.ts
    │   ├── pages/
    │   │   ├── LoginPage/{LoginPage,LoginPage.view}.tsx
    │   │   ├── RegistroPage/{RegistroPage,RegistroPage.view}.tsx
    │   │   └── PerfilPage/{PerfilPage,PerfilPage.view}.tsx
    │   ├── services/perfil.service.ts
    │   └── types.ts
    │
    ├── inventario/                             ← solo lo del catálogo público
    │   ├── api/{categorias.api,productos.api,index}.ts
    │   ├── hooks/{useCategorias,useProductos,index}.ts
    │   ├── services/categorias.service.ts
    │   └── types.ts
    │
    ├── comercial/                              ← solo para Mis compras / Mis devoluciones
    │   ├── components/{VentaDetalle,DevolucionDetalle}.tsx
    │   └── types.ts
    │
    └── electronico/                            ← la tienda completa
        ├── api/{tienda,producto,carrito,reservas,checkout,cuenta,index}.api.ts
        ├── components/
        │   ├── GaleriaProducto.tsx  NotificationBell.tsx  ProductoCard.tsx
        │   ├── PromoBanner.tsx  ReservaEstadoBadge.tsx  SelectorCantidad.tsx
        │   └── StoreFooter.tsx  StoreLogo.tsx  StoreSidebar.tsx
        ├── hooks/{useCarrito,useMisReservas,useProductoDetalle,useSucursalesPublicas,useTemporadasPublicas,index}.ts
        ├── pages/
        │   ├── CatalogoPage/{CatalogoPage,CatalogoPage.view}.tsx
        │   ├── ProductoPage/{ProductoPage,ProductoPage.view}.tsx
        │   ├── CarritoPage/{CarritoPage,CarritoPage.view}.tsx
        │   ├── CheckoutPage/{CheckoutPage,CheckoutPage.view,CheckoutResultadoPages,PaypalRetornoPage}.tsx
        │   ├── MiCuentaPage/CuentaLayout.tsx
        │   ├── MisReservasPage/{MisReservasPage,MisReservasPage.view}.tsx
        │   ├── MisComprasPage/{MisComprasPage,MisComprasPage.view}.tsx
        │   └── MisDevolucionesPage/{MisDevolucionesPage,MisDevolucionesPage.view}.tsx
        ├── services/notificaciones.service.ts
        ├── utils/reservas.ts
        └── types.ts
```

**Pantallas y rutas del cliente**

| Ruta | Pantalla | Cuándo |
|---|---|---|
| `/` | Catálogo (banner de promoción, filtros por categoría y temporada, búsqueda) | siempre |
| `/producto/:id` | Detalle: galería, tallas y colores, Agregar, Reservar y Comprar ahora | siempre |
| `/login`, `/registro` | Iniciar sesión y crear cuenta | sin sesión |
| `/carrito` | Carrito | con sesión |
| `/checkout` | Pago del carrito con QR, PayPal o tarjeta | con sesión |
| `/checkout/reserva/:id` | Pago del anticipo de una reserva | con sesión |
| `/checkout/paypal/retorno`, `/checkout/paypal/cancelado`, `/checkout/exito` | Resultados del pago | con sesión |
| `/mi-cuenta` | Perfil | con sesión |
| `/mi-cuenta/reservas`, `/compras`, `/devoluciones` | Mis reservas, compras y devoluciones | con sesión |

Además, la barra superior tiene la campana de notificaciones, el ícono del carrito y el cambio de tema. El menú lateral cambia a modo cuenta cuando estás dentro de Mi cuenta.

**Lo que NO hay que llevar**
- Todo el panel de administración: `ProtectedLayout`, `Sidebar`, `SidebarView`, `PermissionRoute`, `ComingSoonPage` y las carpetas `operaciones/` y `reporte/`.
- Dentro de `acceso/`: `services/roles.service.ts` y `services/usuarios.service.ts`. `PerfilPage.view` importa de ahí solo la constante `TIPO_USUARIO_LABEL`; muévela y no los necesitas.
- Dentro de `electronico/`: `api/ventasEnLinea.api.ts`, `ReservaDetalle`, `ReservaForm`, `NotificacionForm` y las pantallas `ReservasPage`, `VentasEnLineaPage` y `NotificacionesPage`.
- Dentro de `comercial/` e `inventario/`: todo lo que no esté en la estructura de arriba.
- `reservas.api.ts` y `notificaciones.service.ts` mezclan funciones del cliente y del personal. Del primero solo sirven `fetchMisReservas`, `fetchMiReserva`, `crearMiReserva` y `cancelarMiReserva`. Del segundo, las de notificaciones propias: contador de no leídas, lista y marcar como leída.
- De `comercial/types.ts` solo hacen falta los tipos de venta y devolución. De `appStore` solo el tema.

**Endpoints que usa el cliente (`VITE_API_URL`, por defecto `http://localhost:3000/api`)**
- **Sesión:** `POST /acceso/auth/{login,registro,refresh,logout}`, `GET /acceso/auth/me`, `GET|PUT /acceso/perfil`, `PATCH /acceso/perfil/cambiar-password`.
- **Catálogo (públicos):** `GET /inventario/{categorias,productos,temporadas/publicas}`, `GET /inventario/productos/:id/{publico,relacionados}`, `GET /operaciones/sucursales/publicas`.
- **Carrito:** `GET|DELETE /electronico/carrito`, `POST|PATCH|DELETE /electronico/carrito/items[/:id]`.
- **Reservas:** `GET|POST /electronico/reservas/mias`, `GET /electronico/reservas/mias/:id`, `POST /electronico/reservas/mias/:id/cancelar`.
- **Pago:** `GET /electronico/checkout/metodos`, y `POST /electronico/checkout/{paypal/orden,paypal/capturar,qr,qr/confirmar,tarjeta}`. Para el anticipo de una reserva, las mismas rutas bajo `/electronico/checkout/reservas/:id/...`.
- **Mi cuenta:** `GET /comercial/mi-cuenta/{compras,devoluciones}[/:id]`.
- **Notificaciones:** `GET /electronico/notificaciones/mias/*`.

Todas las respuestas vienen envueltas en `{ data, timestamp }`, como se ve en `core/http/envelope.ts`.

**Tres cosas que cambian al llevarlo a móvil**
1. **PayPal:** hoy redirige el navegador a PayPal y vuelve a `FRONTEND_URL/checkout/paypal/retorno`. En móvil necesitarás un enlace profundo o un WebView, y apuntar `FRONTEND_URL` del backend a eso.
2. **Almacenamiento:** el token de sesión (`authStore`), el tema y la selección de prendas (`seleccionProducto.ts`) usan `localStorage`. Hay que cambiarlos por el almacenamiento del dispositivo.
3. **Librería del QR:** el checkout usa `qrcode.react`, que es solo web. En móvil habría que reemplazarla.

Si me dices con qué tecnología harás la versión móvil (React Native, Expo, Flutter u otra), te preparo el mapa exacto de qué archivo se convierte en qué.