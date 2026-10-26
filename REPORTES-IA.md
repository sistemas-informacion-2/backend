# Reportes Generativos con IA (Gemini) — CU18

> Rama backend: `backRamaNico`. Rama frontend: `frontRamaNico`.

## 0. Actualización: módulo de Reportes dividido en 4 secciones

Lo que sigue en este documento (secciones 1-7) describe el intérprete con IA tal como
se implementó originalmente. Después se sumó una segunda parte: separar el módulo de
"Reportes" en las 4 secciones de siempre (Dashboard, Predefinidos, Constructor QBE,
Generativo/Voz), que antes vivían mezcladas en una sola pantalla.

**Backend — nuevo catálogo de Reportes Predefinidos:**
- `GET /api/reports/predefinidos`: lista el catálogo (`codigo`, `nombre`, `descripcion`,
  `categoria`) — `src/modules/reporte/catalog/reportes-predefinidos.constants.ts`.
- `POST /api/reports/predefinidos/:codigo/ejecutar`: ejecuta uno. El rango de fechas
  ("hoy", "últimos 30 días", "mes actual") se resuelve en el momento de ejecutar, nunca
  queda una fecha fija guardada. Reutiliza `ReportBuilderService.ejecutar()` — mismo
  catálogo/whitelist de campos que ya protegía al Report Builder y al intérprete de
  Gemini, ningún camino nuevo para ejecutar SQL.
- Predefinidos incluidos: *Ventas de hoy*, *Prendas más vendidas (30 días)*, *Ventas por
  sucursal (7 días)*, *Stock crítico*, *Compras del mes*.

**Frontend — el módulo pasó de 1 pantalla a 3 rutas (+ el Dashboard que ya existía):**
- `/admin/reportes/predefinidos` (nueva): tarjetas por categoría, botón "Ejecutar",
  resultado + exportación.
- `/admin/reportes/constructor` (antes `/admin/reportes`): el Report Builder manual
  (fuente, campos, filtros, orden, paginación, plantillas), sin el asistente.
- `/admin/reportes/generativo` (nueva): el pedido en lenguaje natural/voz, separado del
  constructor, con un botón "Ajustar en el Constructor" que lleva la config generada
  allá para retocarla a mano.
- `/admin/reportes` redirige a `.../constructor` para no romper enlaces viejos.
- Sidebar: el grupo "Reportes" pasó de 2 a 4 ítems (Dashboard, Predefinidos,
  Constructor, Por Voz/IA).

**Sin dependencias nuevas** en ninguno de los dos lados — todo reutiliza componentes y
servicios que ya existían (`ReportFiltersBuilder`, `ReportPreviewTable`, el hook de voz,
`ReportBuilderService`).

**Qué quedó explícitamente fuera de esta vuelta** (para no inflar el alcance sin que lo
pidieras de nuevo): catálogo de predefinidos administrable desde la UI (hoy es una
lista fija en código, no hay CRUD), contexto conversacional multi-turno en el
generativo (cada pedido es independiente, no hay "¿y la semana pasada?" todavía) y una
pantalla de auditoría dedicada (las mutaciones ya quedan en `BITACORA` por el
interceptor global existente, pero no hay una vista nueva para reportes
específicamente). Si quieres cualquiera de estas, son extensiones puntuales sobre lo
que ya queda armado, no un rediseño.

### 0.1. Actualización: conversación, lectura en voz y "Refinar" en Generativo

La pantalla de Reportes por Voz/IA (`/admin/reportes/generativo`) ahora mantiene un
historial de la conversación (cada pedido y respuesta quedan como burbujas de chat,
dentro de un panel con encabezado propio "💬 Conversación" para que se note que es un
chat y no texto suelto), lee la respuesta en voz alta con la síntesis de voz nativa del
navegador (`window.speechSynthesis`, sin dependencias nuevas) y agrega un botón
**"Refinar"** que abre el mismo `ReportFiltersBuilder` del Constructor QBE, inline,
para ajustar el reporte activo (columnas/filtros/orden/fechas) sin perder el hilo de la
conversación — "Aplicar" lo re-ejecuta, "Cancelar" restaura la config anterior. El
historial no se persiste entre sesiones; "Nueva conversación" lo reinicia.

### 0.2. Actualización: Constructor QBE reformateado y filtros con AND/OR

El Constructor (`/admin/reportes/constructor`) se reformateó al patrón de 3 pasos
numerados ("1. Entidad y campos", "2. Filtros y orden", "3. Resultado"): el paso 1 usa
un selector de campos de dos columnas (disponibles → columnas del reporte, con
reordenar y quitar) y arranca **sin entidad ni columnas preseleccionadas** (antes
cargaba VENTAS con columnas por defecto). El modal de guardar plantilla
(`SaveTemplateModal`, eliminado) pasó a ser un campo de nombre inline en el paso 3.

Los filtros ganaron un combinador real: `ReportRunRequestDto.matchType` (`'AND'`
por defecto, `'OR'` opcional) — no es solo un toggle visual, `ReportBuilderService`
arma el `WHERE` distinto según el valor (el rango de fechas siempre se combina con
AND, por separado del grupo de filtros). El mismo `ReportFiltersBuilder` se reutiliza
en el panel "Refinar" de Generativo.

## 1. Qué problema resolvía esto

El "asistente generativo" de reportes (`POST /api/reports/generativo`) ya existía, pero
**no usaba ninguna IA**: era un traductor por palabras clave con expresiones regulares
(`ReporteNlpService`) que reconocía frases fijas en español ("más vendidas", "stock
crítico", "última semana"...). Fuera de esas frases exactas, no entendía sinónimos,
modismos ni pedidos compuestos, aunque el botón en el frontend decía "Generar con IA".

Este cambio agrega un intérprete real con **Gemini** (API gratuita de Google AI Studio)
que entiende lenguaje natural de verdad, **sin tocar la base de datos ni el contrato de
la API** (mismo endpoint, mismo DTO de entrada). El traductor por regex **no se borró**:
ahora es el *fallback* si Gemini no está configurado o falla.

## 2. Cómo funciona ahora

```
POST /api/reports/generativo { prompt }
        │
        ▼
 ReportsService.generativo()
        │
        ├─ ¿GeminiReporteService.disponible? (¿hay GEMINI_API_KEY?)
        │        │
        │        ├─ Sí → llama a Gemini con el catálogo de campos válidos
        │        │        (el mismo whitelist del Report Builder) y le pide
        │        │        JSON estructurado (responseSchema). Si Gemini
        │        │        responde bien → fuente = "IA".
        │        │
        │        └─ Si Gemini no está configurado, se cae, tarda demasiado
        │           o devuelve algo inválido → se captura el error y sigue
        │           abajo. Nunca rompe el endpoint.
        │
        └─ ReporteNlpService.interpretar() (regex, el de siempre) → fuente = "REGEX"
                │
                ▼
      ReportBuilderService.ejecutar(request)  (sin cambios: sigue siendo
      el único que arma SQL, siempre desde la whitelist del catálogo)
                │
                ▼
      { prompt, interpretacion, request, result, fuente }
```

**Punto clave de seguridad:** Gemini nunca ve ni genera SQL. Solo puede elegir nombres
de campo que existen en `reporte-catalog.constants.ts` (la misma whitelist que ya
protegía al Report Builder del Report Builder normal). Lo que Gemini responde se vuelve
a validar en el backend antes de ejecutarse:

- Campos (`selectedFields`, `filters[].campo`, `sort.campo`) que no están en el catálogo
  del tipo de reporte elegido se descartan en silencio (no rompen el pedido, solo se
  ignoran).
- Si Gemini elige `INVENTARIO` (una foto del stock, sin fecha) pero igual manda
  `dateFrom`/`dateTo`, esos campos se descartan: ese reporte nunca filtra por fecha.
- Si Gemini menciona una sucursal que no existe en la base de datos, ese filtro se
  descarta (no puede "inventar" una sede).
- `limit` se recorta siempre entre 1 y 100.

## 3. Archivos nuevos/editados

### Backend (`backRamaNico`)

| Archivo | Qué cambió |
| --- | --- |
| `src/modules/reporte/services/gemini-reporte.service.ts` | **Nuevo.** Arma el prompt del sistema (catálogo + sucursales activas + fecha de hoy), llama a la API REST de Gemini con `fetch` nativo y `responseSchema` (JSON forzado), y valida/normaliza la respuesta contra el catálogo real antes de devolverla. |
| `src/modules/reporte/services/gemini-reporte.service.spec.ts` | **Nuevo.** Tests con `fetch` mockeado: valida que descarte campos inventados, sucursales inexistentes, fechas en INVENTARIO, y que propague el error si Gemini falla (para que el fallback funcione). |
| `src/modules/reporte/services/reports.service.ts` | `generativo()` ahora intenta Gemini primero (si `disponible`) y cae a `ReporteNlpService` si no hay key o si Gemini lanza un error (se loguea como `warn`, no rompe la respuesta). Devuelve el nuevo campo `fuente`. |
| `src/modules/reporte/services/reports.service.spec.ts` | Tests actualizados: camino sin Gemini (como antes), camino con Gemini exitoso, y camino con Gemini fallando → fallback. |
| `src/modules/reporte/dto/reporte-builder.dto.ts` | `ReporteGenerativoResponseDto` gana el campo `fuente: 'IA' \| 'REGEX'`. |
| `src/modules/reporte/reporte.module.ts` | Registra `GeminiReporteService` como provider. |
| `src/config/configuration.ts` | Nueva sección `gemini: { apiKey, model }`, leída de `GEMINI_API_KEY` / `GEMINI_MODEL`. |
| `.env.example` | Documenta las dos variables nuevas (vacías = sin IA, cae a regex). |
| `.env` (no versionado) | Tiene la API key real cargada localmente. |

`ReporteNlpService` (el traductor por regex) **no se tocó**: sigue siendo el fallback
tal cual estaba.

### Frontend (`frontRamaNico`)

| Archivo | Qué cambió |
| --- | --- |
| `src/modules/reporte/reportes.types.ts` | `RespuestaGenerativo`/`ReportRunRequest` ganan `fuente: 'IA' \| 'REGEX'` y `matchType?: 'AND' \| 'OR'`. |
| `src/modules/reporte/pages/ReportesGenerativoPage/` | Pantalla de Reportes por Voz/IA (antes mezclada en `ReportesPage`, hoy eliminada): conversación en burbujas dentro de un panel de chat, lectura en voz alta, botón "Refinar" (reutiliza `ReportFiltersBuilder` inline) y la etiqueta **✨ Gemini** / **⚙️ Modo básico** por mensaje. |
| `src/modules/reporte/pages/ReportesConstructorPage/` | Report Builder manual reformateado a 3 pasos numerados; arranca sin entidad ni columnas preseleccionadas. |
| `src/modules/reporte/components/reportes/ReportFiltersBuilder.tsx` | Selector de campos de dos columnas (en vez de checkboxes), filas de filtro con el toggle "Cumplir todos (Y) / Cumplir alguno (O)" (`matchType`), reordenar/quitar columnas. |

El resto del Report Builder (catálogo, filtros manuales, plantillas, exportación) **no
cambió**: esto solo toca el camino del asistente por texto/voz.

## 4. Dependencias instaladas

**Ninguna, ni en backend ni en frontend.**

El backend llama a la API REST de Gemini con el `fetch` global de Node (disponible
desde Node 18+; este proyecto corre en Node 24), exactamente igual a como
`PushService` ya le habla a la API de Expo. No se agregó ningún SDK de Google.

## 5. Variables de entorno nuevas

Solo en el **backend** (`backend/.env`, no versionado):

```bash
# --- Reportes generativos con IA (CU18) ---
# API key de Google AI Studio (gratuita dentro de su cuota): https://aistudio.google.com/apikey
# Vacio = los reportes generativos caen al interprete por palabras clave (regex), sin IA.
GEMINI_API_KEY=
# Opcional: modelo de Gemini a usar. Los modelos "-flash" grandes (ej. 3.8-flash,
# 3.5-flash) suelen devolver 503 "high demand" por saturacion; "-flash-lite" es mas
# liviano, menos pedido y de sobra para esta clasificacion/extraccion.
GEMINI_MODEL=gemini-3.5-flash-lite
```

Si Gemini responde 503 ("alta demanda"), `GeminiReporteService` reintenta **una vez**
con una pausa corta antes de rendirse y caer al modo básico (otros errores, como 403 o
404, se propagan directo sin reintentar — reintentar no cambia nada ahí). Si el 503
persiste incluso cambiando de modelo, es saturación real de Google, no un bug local.

El frontend no necesita ninguna variable nueva: no habla con Gemini directamente, solo
con el backend (igual que antes).

> **Nota sobre la key pegada en `.env`:** si en algún momento deja de responder o da
> error de autenticación, es probable que ese valor concreto no sea (o haya dejado de
> ser) una API key válida de generativelanguage.googleapis.com — genera una nueva en
> [aistudio.google.com/apikey](https://aistudio.google.com/apikey) y reemplázala ahí.
> No hace falta tocar código: si la key falla, el sistema cae solo al modo básico
> (regex) y el endpoint sigue respondiendo con `fuente: "REGEX"`.

## 6. Cómo probarlo

1. Asegúrate de tener `GEMINI_API_KEY` cargada en `backend/.env` (ya está puesta).
2. Levanta el backend normal (`npm run start:dev` o Docker).
3. Entra a `/admin/reportes/generativo` (Sidebar → Reportes → "Reportes por Voz / IA")
   con un usuario con permiso `analitica:reportes:gestionar`.
4. Escribe (o dicta) algo que el regex viejo **no** reconocía, por ejemplo:
   - *"¿Cuáles son las prendas que menos se vendieron este mes en Santa Cruz?"*
   - *"Dame un resumen de lo que compramos a proveedores el trimestre pasado"*
   - *"¿Qué productos están por agotarse?"*
5. La respuesta debería aparecer con la etiqueta **✨ Gemini** y sonar natural (no una
   concatenación de frases fijas); si tenés la voz activada, además la lee en alto.
6. Probá seguir la conversación ("¿y en La Paz?") y el botón "Refinar" para ajustar el
   reporte sin perder el hilo.
7. Para confirmar el fallback: pon `GEMINI_API_KEY=` vacío (o una key inválida),
   reinicia el backend, repite un pedido — debería seguir funcionando, con la etiqueta
   **⚙️ Modo básico**.

## 7. Limitaciones conocidas / próximos pasos

- La capa gratuita de Gemini tiene límite de peticiones por minuto, y los modelos
  "-flash" grandes suelen devolver 503 por saturación (de ahí el default a
  "-flash-lite"). Hay un único reintento automático ante un 503; si falla igual, cae
  al modo básico (no hay cola de reintentos ni backoff progresivo).
- Gemini decide `limit`/`sort`/filtros por heurística del propio modelo; dos pedidos
  casi idénticos pueden dar reportes ligeramente distintos (no es determinístico como
  el regex). Para un reporte reproducible exacto, usar el Report Builder manual o
  guardar el resultado como plantilla.
- No hay caché de respuestas de Gemini: cada pedido genera una llamada nueva. Si el
  volumen de uso crece, valdría la pena cachear por prompt normalizado.
