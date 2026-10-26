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
servicios que ya existían (`ReportFiltersBuilder`, `ReportPreviewTable`,
`SaveTemplateModal`, el hook de voz, `ReportBuilderService`).

**Qué quedó explícitamente fuera de esta vuelta** (para no inflar el alcance sin que lo
pidieras de nuevo): catálogo de predefinidos administrable desde la UI (hoy es una
lista fija en código, no hay CRUD), contexto conversacional multi-turno en el
generativo (cada pedido es independiente, no hay "¿y la semana pasada?" todavía),
síntesis de voz (lectura en voz alta de la respuesta) y una pantalla de auditoría
dedicada (las mutaciones ya quedan en `BITACORA` por el interceptor global existente,
pero no hay una vista nueva para reportes específicamente). Si quieres cualquiera de
estas, son extensiones puntuales sobre lo que ya queda armado, no un rediseño.

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
| `src/modules/reporte/reportes.types.ts` | `RespuestaGenerativo` gana el campo `fuente: 'IA' \| 'REGEX'`. |
| `src/modules/reporte/pages/ReportesPage/ReportesPage.tsx` | Guarda `fuente` de la respuesta en estado (`fuenteInterpretacion`) y se lo pasa a la vista. |
| `src/modules/reporte/pages/ReportesPage/ReportesPage.view.tsx` | El cuadro de "Interpretación" ahora muestra una etiqueta: **✨ Gemini** (verde) si respondió la IA, o **⚙️ Modo básico** (ámbar, con tooltip explicando por qué) si cayó al traductor por regex. Así el usuario ve honestamente cuál de los dos respondió, en vez del botón "Generar con IA" fijo sin indicar si de verdad hubo IA. |

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
# Opcional: modelo de Gemini a usar. gemini-2.5-flash es rapido y entra comodo en la capa gratuita.
GEMINI_MODEL=gemini-2.5-flash
```

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
3. Entra a `/admin/reportes` con un usuario con permiso `analitica:reportes:gestionar`.
4. En el "Asistente generativo", escribe (o dicta) algo que el regex viejo **no**
   reconocía, por ejemplo:
   - *"¿Cuáles son las prendas que menos se vendieron este mes en Santa Cruz?"*
   - *"Dame un resumen de lo que compramos a proveedores el trimestre pasado"*
   - *"¿Qué productos están por agotarse?"*
5. Debajo de "Interpretación" debería aparecer la etiqueta **✨ Gemini**, y el texto
   de interpretación debería sonar natural (no una concatenación de frases fijas).
6. Para confirmar el fallback: pon `GEMINI_API_KEY=` vacío (o una key inválida),
   reinicia el backend, repite un pedido — debería seguir funcionando, con la etiqueta
   **⚙️ Modo básico**.

## 7. Limitaciones conocidas / próximos pasos

- La capa gratuita de Gemini tiene límite de peticiones por minuto. Si se supera, la
  llamada falla y cae al modo básico automáticamente (no hay cola de reintentos).
- Gemini decide `limit`/`sort`/filtros por heurística del propio modelo; dos pedidos
  casi idénticos pueden dar reportes ligeramente distintos (no es determinístico como
  el regex). Para un reporte reproducible exacto, usar el Report Builder manual o
  guardar el resultado como plantilla.
- No hay caché de respuestas de Gemini: cada pedido genera una llamada nueva. Si el
  volumen de uso crece, valdría la pena cachear por prompt normalizado.
