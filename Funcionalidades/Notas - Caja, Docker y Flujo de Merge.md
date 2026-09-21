# Notas Técnicas – Caja, Docker y Flujo de Merge

> Documento de apoyo del Ciclo #3. Recopila las consultas hechas durante el
> desarrollo de **CU15 – Gestionar Caja**: el campo `concepto`, la revisión de
> la configuración Docker y el flujo para subir cambios y mergear con el equipo.

---

## 1. CU15 – Campo `concepto` en los movimientos de caja

En caja, `concepto` es **texto libre obligatorio**: la razón/descripción del
movimiento. No es un catálogo ni un enum; lo escribe el usuario.

Flujo actual:

| Capa | Archivo | Detalle |
| --- | --- | --- |
| Formulario | `frontend/src/modules/comercial/components/MovimientoCajaForm.tsx` | `Input` "Concepto", requerido, máx. 150 caracteres |
| Tipo frontend | `frontend/src/modules/comercial/types.ts` | `MovimientoCajaFormValues.concepto` |
| Envío | `frontend/src/modules/comercial/services/caja.service.ts` | `concepto: values.concepto` |
| Validación backend | `backend/src/modules/comercial/dto/crear-movimiento-caja.dto.ts` | `@IsString @IsNotEmpty @MaxLength(150)` |
| Persistencia | `backend/src/modules/comercial/services/caja.service.ts` | Se guarda con `.trim()` |
| Tabla | `backend/Base de Datos/FashionStoreDB.sql` | `movimiento_caja.concepto VARCHAR(150) NOT NULL` |
| Entidad | `backend/src/modules/comercial/entities/movimiento-caja.entity.ts` | `concepto: string` |
| Salida | `backend/src/modules/comercial/mappers/caja.mapper.ts` | Se devuelve tal cual |
| Vista | `backend/.../CajaPage.view.tsx` | Columna "Concepto" de la tabla de movimientos |

Ejemplos de uso: "Venta mostrador", "Depósito a banco", "Retiro de caja",
"Pago a proveedor".

> **Ojo:** existe además `PAGO.concepto`, que **sí** es un enum
> (`PAGO_TOTAL`, `ANTICIPO_RESERVA`, `SALDO_LIQUIDACION`, `REEMBOLSO` en
> `FashionStoreDB.sql`). Ese pertenece a CU12 y todavía no se usa.

Cuando se implementen CU12/CU14, esos flujos podrán autogenerar el concepto
(ej. "Venta presencial #123", "Compra a proveedor X") al crear el movimiento de
caja.

**Mejora futura posible:** reemplazar el texto libre por un selector de valores
predefinidos (Venta, Retiro, Depósito, Pago a proveedor, Otros) más un campo de
detalle.

---

## 2. Revisión de la configuración Docker

Compose (`docker-compose.yml` + `docker-compose.override.yml`), Dockerfiles,
`.env`, nginx y `.dockerignore` están **bien armados**: credenciales unificadas
en `backend/.env` (verificado que `DB_USERNAME/DB_PASSWORD/DB_NAME` coinciden con
`POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB`), `db` con healthcheck y
`depends_on: condition: service_healthy`, proxy `/api` en nginx, `tini` y
usuario `node` en el backend.

### Hallazgos

| # | Severidad | Hallazgo | Impacto |
| --- | --- | --- | --- |
| 1 | Alta (prod) | `backend/Dockerfile` healthcheck hace `fetch('.../')`, pero con `setGlobalPrefix('api')` no existe la ruta `/` → 404 → contenedor `unhealthy`. | Solo producción; la etapa `dev` no tiene HEALTHCHECK. |
| 2 | Media | `backend/.env` no define `PAGOS_ENCRYPTION_KEY` (el `.env.example` sí). | CU16 no podrá guardar credenciales de pasarela. |
| 3 | Media (prod) | `synchronize` está off con `NODE_ENV=production` y no hay migraciones ni carga del SQL. | En un volumen Postgres nuevo, no se crean las tablas. |
| 4 | Baja | El compose base publica `8080:80` y el override añade `5173:5173` (dev escucha 5173). | El 8080 queda muerto en dev; entrar por `http://localhost:5173`. |
| 5 | Baja | `CORS_ORIGIN=http://localhost:5173` fijo. | Bloquea CORS si se entra por `127.0.0.1:5173`. |
| 6 | Baja | Volumen anónimo `/app/node_modules` con bind mount de Windows. | Tras cambiar dependencias: `docker compose up --build -V`. |
| 7 | Baja | El backend no usa polling en `nest start --watch` (el frontend sí). | El hot-reload puede no detectar cambios en bind mounts Windows. |

### Fixes propuestos (pendientes de aplicar)

1. **Healthcheck backend:** apuntar a `/api/docs` o agregar `GET /api/health` y
   usar esa URL.
2. **`PAGOS_ENCRYPTION_KEY`:** agregar la clave (64 hex) a `backend/.env`.
3. **Producción:** documentar que requiere migraciones o cargar
   `FashionStoreDB.sql`.
4. **Puertos/CORS:** documentar `5173` en dev y ampliar `CORS_ORIGIN` a
   `http://localhost:5173,http://127.0.0.1:5173`.
5. **node_modules:** documentar `docker compose up --build -V` al cambiar deps.
6. **Watch backend (opcional):** habilitar polling para hot-reload fiable en
   Windows.

### Arranque en dev (recordatorio)

```powershell
# Docker Desktop debe estar corriendo
docker compose up --build
```

- Frontend (dev): `http://localhost:5173`
- Backend / Swagger: `http://localhost:3000/api/docs`

---

## 3. Flujo de commit / push / merge

### 3.1 Estado del repositorio

**No hay repo raíz: son dos repos separados** (`backend/.git` y `frontend/.git`).
Hay que commitear y pushear en ambos.

| | Backend | Frontend |
| --- | --- | --- |
| Remoto | `sistemas-informacion-2/backend` | `sistemas-informacion-2/frontend` |
| Rama de trabajo | `javiDev` | `javidevfront` |
| Ramas remotas | `main`, `backRamaNico`, `javiDev` | `main`, `frontRamaNico`, `javidevfront` |

Al momento de estas notas, ambas ramas locales estaban **3 commits adelante** de
`origin` y con cambios sin commitear (CU07, CU16, CU19 y CU15).

### 3.2 Listo para subir

- Backend: `build` OK y **43 tests** verdes.
- Frontend: `lint` y `build` OK.
- Sin secretos: `backend/.env` está ignorado; los `.env` del frontend son
  públicos.
- Sin cambios de dependencias (lockfiles intactos) → merge limpio en ese aspecto.

Cosas a tener en cuenta (ninguna impide el push):

1. El commit incluye también CU07/CU16/CU19 sin commitear, no solo CU15.
2. `backend/tsconfig.build.tsbuildinfo` está **trackeado** (artefacto de build).
   Opcional: `git rm --cached tsconfig.build.tsbuildinfo`.
3. `backend/uploads/*.jpg` está trackeado (datos de runtime); opcional
   destrackear.
4. Hay que subir **los dos repos**.

### 3.3 Comandos para subir

```powershell
# Backend
git add -A
git commit -m "Ciclo 2/3: CU07, CU16, CU19, CU15 (caja atada a cajero)"
git push origin javiDev

# Frontend
git add -A
git commit -m "Ciclo 2/3: CU07, CU16, CU19, CU15 (pantalla de caja)"
git push origin javidevfront
```

### 3.4 Merge en la rama del compañero

```powershell
git fetch origin
git checkout backRamaNico        # frontRamaNico en el repo de frontend
git merge origin/javiDev         # origin/javidevfront en el repo de frontend
# resolver conflictos, luego:
npm install
```

Alternativa más ordenada: intégralo a `main` y que el compañero haga
`git merge origin/main`.

### 3.5 Archivos "puente" con riesgo de conflicto

Donde suelen chocar ambos desarrolladores:

- **Backend:** `src/app.module.ts`, `src/config/configuration.ts`,
  `src/main.ts`, `src/database/seeders/initial-seeder.service.ts`,
  `src/common/interceptors/audit.interceptor.ts`,
  `src/modules/inventario/inventario.module.ts`,
  `Base de Datos/FashionStoreDB.sql`.
- **Frontend:** `src/App.tsx`, `src/shared/components/layout/Sidebar.tsx`,
  `PublicLayout.tsx`, `ProtectedLayout.tsx`, `src/core/context/AuthContext.tsx`,
  `src/core/http/httpClient.ts`, `src/core/http/errors.ts`,
  `src/modules/inventario/types.ts`.

Recomendaciones: commit/backup de la rama antes de mergear, usar
`git merge --no-ff` y revisar imports/registros de módulos/rutas en los archivos
"puente", no solo los archivos nuevos de CU15.

### 3.6 Después del merge (para que CU15 funcione)

1. Reiniciar el backend en dev: el seeder crea el permiso
   `comercial:caja:gestionar` y `synchronize` agrega `caja.id_cajero`. Con
   Docker + `docker-compose.override.yml` es automático al reiniciar.
2. En **producción** (`NODE_ENV=production`, `synchronize` off), aplicar a mano:

   ```sql
   ALTER TABLE caja ADD COLUMN id_cajero INT REFERENCES empleado(id_usuario);
   ```

3. Entrar como administrador a `/admin/caja` y probar abrir / registrar / cerrar.
4. Mergear **los dos repos**; si solo se baja uno, la ruta/permiso no calza.
