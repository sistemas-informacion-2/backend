# Guía de despliegue — Azure App Service + Supabase

Esta guía explica cómo desplegar la API de FashionStore (NestJS 12, TypeORM, PostgreSQL) en **Azure App Service para contenedores**, usando **Supabase** como base de datos PostgreSQL administrada.

---

## 1. Arquitectura

```
                 HTTPS                              TLS (Session pooler, :5432)
  Frontend ────────────────▶  Azure App Service  ─────────────────────────────▶  Supabase Postgres
  (navegador)                 (contenedor Docker,                                (BD administrada)
                               imagen desde ACR)
                                      │
                                      │ montaje SMB en /app/uploads
                                      ▼
                              Recurso compartido
                              de Azure Files
                              (imágenes, modelos 3D)
```

| Componente | Recurso de Azure / Supabase | Función |
|---|---|---|
| Imagen del contenedor | Azure Container Registry (ACR) | Guarda la imagen construida desde la etapa `runner` del `Dockerfile` |
| Ejecución de la API | Plan de App Service (Linux) + Web App for Containers | Ejecuta la API en el puerto 3000; Azure termina el TLS |
| Almacenamiento de archivos | Cuenta de almacenamiento + recurso compartido de Azure Files | Conserva `uploads/` (el disco del contenedor es efímero) |
| Base de datos | Proyecto de Supabase | PostgreSQL, accedido a través del **Session pooler** |

### Por qué estas decisiones

- **Session pooler en lugar de la conexión directa.** El host directo de Supabase (`db.<ref>.supabase.co`) solo resuelve a IPv6, y el tráfico saliente de App Service es IPv4. El Session pooler (Supavisor, puerto `5432`) es compatible con IPv4 y se comporta como una sesión normal de Postgres, así que las transacciones de TypeORM funcionan sin cambios. No uses el *Transaction pooler* (puerto `6543`) para este servicio.
- **Azure Files para los uploads.** `ArchivosController` y `ProbadorModelosController` escriben en `<cwd>/uploads` en el disco local. Sin un recurso compartido montado, cada reinicio, escalado o nuevo despliegue pierde esos archivos.

---

## 2. Requisitos previos

- Una suscripción de Azure y la [CLI de Azure](https://learn.microsoft.com/cli/azure/install-azure-cli) (con `az login` hecho)
- Docker Desktop (con BuildKit, que viene activado por defecto)
- Una cuenta de Supabase
- Node.js 24 (solo para crear el esquema una única vez, en el paso 3.3)

> Los comandos de esta guía usan **sintaxis bash**. En Windows, ejecútalos desde Git Bash, WSL o Azure Cloud Shell.

Define estas variables una vez por sesión de terminal:

```bash
# --- Ajusta estos valores ---
RG=rg-fashionstore
LOCATION=brazilsouth            # Región de Azure más cercana a Bolivia; elige la región de Supabase cercana (sa-east-1)
ACR=fashionstoreacr             # Único a nivel global; solo minúsculas y números
PLAN=plan-fashionstore
APP=fashionstore-api            # Único a nivel global; será https://$APP.azurewebsites.net
STORAGE=fashionstorefiles       # Único a nivel global; solo minúsculas y números
SHARE=uploads
IMAGE=fashionstore-api
TAG=v1
```

---

## 3. Supabase (base de datos)

### 3.1 Crear el proyecto

1. En el panel de Supabase, crea un proyecto nuevo.
2. Elige la **región más cercana a tu región de Azure** (por ejemplo, `South America (São Paulo) / sa-east-1` para `brazilsouth`). Si la base de datos está en otra región, cada petición suma latencia.
3. Guarda la **contraseña de la base de datos**. La necesitas para `DB_PASSWORD`.

### 3.2 Obtener los datos de conexión

En el proyecto, haz clic en **Connect** y elige **Session pooler**. Asigna los valores así:

| Valor en Supabase | Variable de entorno | Ejemplo |
|---|---|---|
| Host | `DB_HOST` | `aws-0-sa-east-1.pooler.supabase.com` |
| Port | `DB_PORT` | `5432` |
| User | `DB_USERNAME` | `postgres.abcdefghijklmnop` *(incluye la referencia del proyecto)* |
| Password | `DB_PASSWORD` | la contraseña del paso 3.1 |
| Database | `DB_NAME` | `postgres` |

Supabase exige TLS. La app no tiene una opción SSL en `database.config.ts`, pero cuando TypeORM no envía una, el driver `pg` lee la variable estándar `PGSSLMODE`. Configura:

```
PGSSLMODE=no-verify
```

Así la conexión va cifrada, pero no se verifica la cadena de certificados de Supabase, porque Supabase usa su propia CA raíz. Para una verificación completa, consulta la [Sección 8](#8-mejoras-recomendadas).

### 3.3 Crear el esquema (inicialización única)

Cuando `NODE_ENV=production`, TypeORM **no** sincroniza el esquema (`synchronize: false` en `src/database/database.config.ts`), y el proyecto no tiene migraciones. Además, la API ejecuta sus seeders al arrancar (`main.ts`), así que **se cae con una base de datos vacía**. Crea el esquema antes del primer despliegue.

**Opción A (recomendada): que TypeORM lo cree a partir de las entidades**

Las entidades son la fuente de verdad. Ejecuta la API una vez desde tu máquina contra Supabase, en modo desarrollo:

```bash
# Desde la carpeta backend, en Git Bash
npm ci
NODE_ENV=development \
DB_HOST=aws-0-sa-east-1.pooler.supabase.com \
DB_PORT=5432 \
DB_USERNAME=postgres.abcdefghijklmnop \
DB_PASSWORD='<tu-contraseña>' \
DB_NAME=postgres \
PGSSLMODE=no-verify \
JWT_SECRET=solo-para-inicializar \
PAGOS_ENCRYPTION_KEY=<la-misma-clave-que-usarás-en-producción> \
SEED_ADMIN_EMAIL=admin@fashionstore.com \
SEED_ADMIN_PASSWORD='<contraseña-segura-del-admin>' \
npm run start
```

Cuando veas `Nest application successfully started`, detén el proceso con `Ctrl+C`. Para entonces TypeORM ya creó todas las tablas, y los seeders insertaron los permisos, el rol `ADMINISTRADOR`, el usuario administrador, los departamentos, los métodos de pago, las categorías y las temporadas.

> Usa la **misma `PAGOS_ENCRYPTION_KEY`** aquí y en Azure. Las credenciales de los métodos de pago se cifran con AES-256-GCM, y lo que se cifró con una clave no se puede descifrar con otra.

**Opción B: ejecutar el script SQL**

Abre el **SQL Editor** de Supabase, pega el contenido de `Base de Datos/FashionStoreDB.sql` y ejecútalo. Los seeders cargan los datos base en el primer arranque en Azure. Usa esta opción solo si el script coincide con las entidades actuales. Si una entidad cambió y el script no, las consultas fallarán en tiempo de ejecución.

### 3.4 Cerrar la Data API de Supabase (importante)

Por defecto, Supabase expone todas las tablas del esquema `public` a través de su API REST autogenerada (PostgREST), y cualquiera con la clave pública `anon` del proyecto puede llamarla. Este backend se conecta como `postgres` y no usa esa API. Ciérrala con **una** de estas opciones:

- **Project Settings → Data API**: desactiva la Data API, o quita `public` de *Exposed schemas*; **o bien**
- Activa Row Level Security en todas las tablas, sin políticas. El rol `postgres` ignora RLS, así que la API sigue funcionando:

  ```sql
  DO $$
  DECLARE t record;
  BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    END LOOP;
  END $$;
  ```

### 3.5 Limitación del plan gratuito

Los proyectos gratuitos de Supabase se **pausan tras unos 7 días sin actividad**. Un proyecto pausado rechaza conexiones, y la API falla al arrancar. Usa un plan de pago para todo lo que deba estar siempre en línea.

---

## 4. Recursos en Azure

### 4.1 Grupo de recursos y registro de contenedores

```bash
az group create --name $RG --location $LOCATION

az acr create --resource-group $RG --name $ACR --sku Basic
```

### 4.2 Construir y subir la imagen

El `Dockerfile` usa montajes de caché de BuildKit (`RUN --mount=type=cache`), así que construye la imagen localmente con Docker en lugar de usar `az acr build`. Construye la etapa **`runner`**. La etapa `dev` es la primera del archivo y solo sirve para recarga en caliente.

```bash
az acr login --name $ACR

docker build --platform linux/amd64 --target runner -t $ACR.azurecr.io/$IMAGE:$TAG .
docker push $ACR.azurecr.io/$IMAGE:$TAG
```

> Usa una etiqueta nueva en cada versión (`v2`, `v3` o el SHA del commit) en lugar de reutilizar `latest`. Así, volver a una versión anterior es un solo comando.

### 4.3 Plan de App Service y aplicación web

```bash
# B1 es el nivel más pequeño que admite "Always On" y montajes de almacenamiento
az appservice plan create --resource-group $RG --name $PLAN --is-linux --sku B1

az webapp create --resource-group $RG --plan $PLAN --name $APP \
  --container-image-name $ACR.azurecr.io/$IMAGE:$TAG
```

### 4.4 Permitir que la aplicación descargue desde ACR (identidad administrada)

Esta configuración evita el usuario administrador de ACR y no guarda ninguna contraseña del registro:

```bash
PRINCIPAL_ID=$(az webapp identity assign --resource-group $RG --name $APP --query principalId -o tsv)
ACR_ID=$(az acr show --name $ACR --query id -o tsv)

az role assignment create --assignee $PRINCIPAL_ID --role AcrPull --scope $ACR_ID

az webapp config set --resource-group $RG --name $APP \
  --generic-configurations '{"acrUseManagedIdentityCreds": true}'

az webapp config container set --resource-group $RG --name $APP \
  --container-image-name $ACR.azurecr.io/$IMAGE:$TAG \
  --container-registry-url https://$ACR.azurecr.io
```

### 4.5 Almacenamiento persistente para uploads

```bash
az storage account create --resource-group $RG --name $STORAGE \
  --location $LOCATION --sku Standard_LRS --kind StorageV2

STORAGE_KEY=$(az storage account keys list --resource-group $RG \
  --account-name $STORAGE --query "[0].value" -o tsv)

az storage share-rm create --resource-group $RG --storage-account $STORAGE \
  --name $SHARE --quota 10

az webapp config storage-account add --resource-group $RG --name $APP \
  --custom-id uploads --storage-type AzureFiles \
  --account-name $STORAGE --share-name $SHARE \
  --access-key $STORAGE_KEY --mount-path /app/uploads
```

La app guarda los modelos 3D en `uploads/modelos/` y crea esa carpeta si no existe. No hace falta crearla antes en el recurso compartido.

### 4.6 Configuración de ejecución

```bash
az webapp config set --resource-group $RG --name $APP \
  --always-on true \
  --generic-configurations '{"healthCheckPath": "/api/docs"}'

az webapp log config --resource-group $RG --name $APP \
  --docker-container-logging filesystem
```

- **Always On** mantiene el contenedor activo. Sin esta opción, la primera petición tras un periodo de inactividad paga el arranque del contenedor, la conexión a la base de datos y los seeders.
- **Health check** usa `/api/docs` (Swagger UI), que responde `200` sin autenticación. La API no tiene un endpoint de salud propio, y `/` responde `404` por el prefijo global `api`.

---

## 5. Variables de entorno

App Service pasa los **App settings** al contenedor como variables de entorno. En Azure la app nunca lee un archivo `.env`, y `.dockerignore` excluye `.env` de la imagen.

### 5.1 Referencia

| Variable | Valor en producción | Notas |
|---|---|---|
| `WEBSITES_PORT` | `3000` | Indica a App Service a qué puerto del contenedor enviar el tráfico |
| `NODE_ENV` | `production` | Desactiva `synchronize` de TypeORM |
| `PORT` | `3000` | Debe coincidir con `WEBSITES_PORT` |
| `DB_HOST` | Host del Session pooler | Ver [3.2](#32-obtener-los-datos-de-conexión) |
| `DB_PORT` | `5432` | Puerto del Session pooler |
| `DB_USERNAME` | `postgres.<project-ref>` | |
| `DB_PASSWORD` | *(secreto)* | |
| `DB_NAME` | `postgres` | |
| `PGSSLMODE` | `no-verify` | Activa TLS hacia Supabase |
| `CORS_ORIGIN` | `https://<dominio-del-frontend>` | Origen exacto, sin barra final. Si falta, el valor por defecto es `*` |
| `FRONTEND_URL` | `https://<dominio-del-frontend>` | PayPal redirige aquí al usuario después del pago |
| `JWT_SECRET` | *(secreto)* | Cadena aleatoria larga, por ejemplo `openssl rand -base64 48` |
| `JWT_ACCESS_EXPIRATION` | `15m` | |
| `JWT_REFRESH_EXPIRATION` | `7d` | |
| `SEED_ADMIN_EMAIL` | correo del administrador | Solo se usa si el usuario administrador aún no existe |
| `SEED_ADMIN_PASSWORD` | *(secreto)* | Cámbiala respecto al valor de ejemplo |
| `PAGOS_ENCRYPTION_KEY` | *(secreto)* | 64 caracteres hexadecimales (`openssl rand -hex 32`). **Nunca la cambies sin volver a cifrar los datos guardados** |
| `PAGOS_SIMULADOS` | `false` | Si es `true`, los pagos con QR y tarjeta se aprueban sin cobrar |
| `PAYPAL_MODE` | `sandbox` o `live` | |
| `PAYPAL_SANDBOX_CLIENT_ID` / `PAYPAL_SANDBOX_CLIENT_SECRET` | *(secreto)* | Cuando `PAYPAL_MODE=sandbox` |
| `PAYPAL_LIVE_CLIENT_ID` / `PAYPAL_LIVE_CLIENT_SECRET` | *(secreto)* | Cuando `PAYPAL_MODE=live` |
| `PAYPAL_CURRENCY` | `USD` | PayPal no opera con BOB |
| `PAYPAL_BOB_USD_RATE` | `6.96` | Bolivianos por cada USD |

### 5.2 Aplicarlas

```bash
az webapp config appsettings set --resource-group $RG --name $APP --settings \
  WEBSITES_PORT=3000 \
  NODE_ENV=production \
  PORT=3000 \
  DB_HOST=aws-0-sa-east-1.pooler.supabase.com \
  DB_PORT=5432 \
  DB_USERNAME=postgres.abcdefghijklmnop \
  DB_PASSWORD='<contraseña-bd>' \
  DB_NAME=postgres \
  PGSSLMODE=no-verify \
  CORS_ORIGIN=https://<dominio-del-frontend> \
  FRONTEND_URL=https://<dominio-del-frontend> \
  JWT_SECRET='<secreto-jwt>' \
  JWT_ACCESS_EXPIRATION=15m \
  JWT_REFRESH_EXPIRATION=7d \
  SEED_ADMIN_EMAIL=admin@fashionstore.com \
  SEED_ADMIN_PASSWORD='<contraseña-admin>' \
  PAGOS_ENCRYPTION_KEY='<64-caracteres-hex>' \
  PAGOS_SIMULADOS=false \
  PAYPAL_MODE=sandbox \
  PAYPAL_SANDBOX_CLIENT_ID='<client-id>' \
  PAYPAL_SANDBOX_CLIENT_SECRET='<client-secret>' \
  PAYPAL_CURRENCY=USD \
  PAYPAL_BOB_USD_RATE=6.96
```

Al cambiar los app settings, el contenedor se reinicia automáticamente.

> **Secretos en Key Vault (opcional, recomendado).** En lugar de guardar los secretos como app settings en texto plano, guárdalos en Azure Key Vault y referéncialos como `@Microsoft.KeyVault(SecretUri=https://<vault>.vault.azure.net/secrets/<nombre>/)`. Asigna a la identidad administrada de la aplicación el rol *Key Vault Secrets User* sobre el vault.

---

## 6. Verificar el despliegue

```bash
# Seguir los logs del contenedor
az webapp log tail --resource-group $RG --name $APP
```

Un arranque correcto muestra la conexión de TypeORM, los seeders y `Nest application successfully started`. Después comprueba:

1. **Swagger UI:** abre `https://$APP.azurewebsites.net/api/docs`.
2. **Login:** llama a `POST /api/auth/login` con `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD`. Deberías recibir un JWT.
3. **Los uploads persisten:** sube una imagen de producto, reinicia la app (`az webapp restart -g $RG -n $APP`) y vuelve a abrir la URL devuelta.
4. **CORS:** desde el frontend desplegado, confirma que el navegador no bloquea las peticiones.

---

## 7. Actualizar y revertir

**Desplegar una versión nueva:**

```bash
TAG=v2
docker build --platform linux/amd64 --target runner -t $ACR.azurecr.io/$IMAGE:$TAG .
docker push $ACR.azurecr.io/$IMAGE:$TAG

az webapp config container set --resource-group $RG --name $APP \
  --container-image-name $ACR.azurecr.io/$IMAGE:$TAG \
  --container-registry-url https://$ACR.azurecr.io
```

**Revertir:** ejecuta el mismo comando `az webapp config container set` con la etiqueta anterior.

**Cambios en el esquema:** el proyecto no tiene migraciones y en producción no se sincroniza. Cuando una versión agrega o cambia columnas de una entidad, aplica el cambio en Supabase **antes** de desplegar la imagen nueva:

- Escribe a mano las sentencias `ALTER TABLE ...` y ejecútalas en el SQL Editor de Supabase. Es la opción más segura.
- O repite la [Opción A del paso 3.3](#33-crear-el-esquema-inicialización-única) contra la base de datos de producción. **Advertencia:** `synchronize` también elimina las columnas y tablas que ya no existen en las entidades, lo que **borra esos datos de forma permanente**. Haz antes un respaldo (Supabase → Database → Backups), o pruébalo contra una copia.

A largo plazo, agrega migraciones de TypeORM para que los cambios de esquema queden versionados y sean repetibles.

---

## 8. Mejoras recomendadas

### 8.1 URLs HTTPS para los archivos subidos (ya aplicado)

`ArchivosController` y `ProbadorModelosController` construyen las URLs de los archivos a partir de `request.protocol`. Azure termina el TLS antes del contenedor, así que sin configuración adicional la app ve HTTP plano y devuelve URLs `http://...`, que un frontend en HTTPS bloquea como *contenido mixto*. `src/main.ts` ya le indica a Express que confíe exactamente en un salto de proxy:

```ts
server.set('trust proxy', 1);
```

Con esta configuración, `request.protocol` sigue a `X-Forwarded-Proto`, y `request.ip` (que se guarda en la bitácora) es la IP real del cliente en lugar de la del front end de Azure. El valor es `1` y no `true` para que los clientes no puedan falsear su IP enviando su propio encabezado `X-Forwarded-For`. Si agregas otro proxy delante de App Service (por ejemplo, Azure Front Door o Application Gateway), sube el número según la cantidad de saltos.

### 8.2 Verificar el certificado de la base de datos

Para reemplazar `PGSSLMODE=no-verify` por una verificación completa, descarga el certificado de la CA desde **Supabase → Project Settings → Database → SSL Configuration**. Luego pásalo con la opción `ssl` de TypeORM en `src/database/database.config.ts`, por ejemplo `ssl: { ca: process.env.DB_SSL_CA }`, y guarda el contenido del certificado como app setting.

### 8.3 Agregar un endpoint de salud real

El `HEALTHCHECK` del `Dockerfile` consulta `/`, que responde `404` por el prefijo global `api`, así que Docker marca el contenedor como no saludable. App Service ignora `HEALTHCHECK` y usa su propio `healthCheckPath`, pero un `GET /api/health` dedicado que además consulte la base de datos daría una señal más fiable a ambos.

### 8.4 Varias instancias

Escalar a más de una instancia funciona: los uploads viven en el montaje compartido de Azure Files y los seeders son idempotentes. Cada instancia abre su propio pool de conexiones, así que mantén el total dentro del límite de conexiones del pooler de tu plan de Supabase.

---

## 9. Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| `ENETUNREACH` o `getaddrinfo ENOTFOUND db.<ref>.supabase.co` | Se usó el host de conexión directa (solo IPv6) | Usa el host del **Session pooler** |
| `Tenant or user not found` | A `DB_USERNAME` le falta la referencia del proyecto | Usa `postgres.<project-ref>` |
| `self-signed certificate in certificate chain` | Se verifica el TLS sin la CA de Supabase | `PGSSLMODE=no-verify`, o ver [8.2](#82-verificar-el-certificado-de-la-base-de-datos) |
| `relation "..." does not exist` al arrancar | El esquema nunca se creó (en producción no se sincroniza) | Sigue el paso [3.3](#33-crear-el-esquema-inicialización-única) |
| El contenedor se reinicia en bucle; *"didn't respond to HTTP pings on port"* | Falta `WEBSITES_PORT` o no coincide con `PORT` | Configura ambos en `3000` |
| `ImagePullFailure` o descarga no autorizada | La identidad administrada no tiene `AcrPull`, o falta `acrUseManagedIdentityCreds` | Repite el paso [4.4](#44-permitir-que-la-aplicación-descargue-desde-acr-identidad-administrada) |
| Las imágenes subidas desaparecen tras un reinicio | El recurso compartido de Azure Files no está montado | Repite el paso [4.5](#45-almacenamiento-persistente-para-uploads) y revisa `az webapp config storage-account list` |
| El navegador bloquea imágenes como contenido mixto | Se generan URLs `http://` detrás del proxy | Comprueba que la imagen desplegada incluya `trust proxy` ([8.1](#81-urls-https-para-los-archivos-subidos-ya-aplicado)) |
| Errores de CORS en el navegador | `CORS_ORIGIN` no coincide exactamente con el origen del frontend | Pon el esquema y el host exactos, sin barra final |
| La API funcionaba y de pronto no puede conectarse | El proyecto gratuito de Supabase se pausó | Restáuralo desde el panel de Supabase |
