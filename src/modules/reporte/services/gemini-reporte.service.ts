import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import type { AppConfig } from '../../../config/configuration.js';
import { FUENTES_REPORTE, type FuenteReporte } from '../catalog/reporte-catalog.constants.js';
import type { ReportFilterDto, ReportRunRequestDto } from '../dto/reporte-builder.dto.js';
import type { InterpretacionPrompt } from './reporte-nlp.service.js';

const TIPOS_VALIDOS = ['VENTAS', 'INVENTARIO', 'COMPRAS'] as const;
type TipoReporte = (typeof TIPOS_VALIDOS)[number];

const OPERADORES_VALIDOS = ['eq', 'ne', 'contains', 'startsWith', 'endsWith', 'gt', 'gte', 'lt', 'lte'] as const;

// Campos por defecto cuando Gemini no selecciona ninguno valido para el tipo
// elegido; intencionalmente el mismo criterio que ReporteNlpService (fallback
// regex), duplicado a proposito: cada interprete queda autocontenido y no se
// rompe si el otro cambia.
const CAMPOS_POR_DEFECTO: Record<TipoReporte, string[]> = {
  VENTAS: ['fecha_emision', 'sucursal', 'producto', 'categoria', 'monto_total', 'cantidad'],
  INVENTARIO: ['sucursal', 'almacen', 'producto', 'variante', 'stock_disponible', 'en_stock_critico'],
  COMPRAS: ['fecha_emision', 'sucursal', 'proveedor', 'total'],
};

const ORDEN_POR_DEFECTO: Record<TipoReporte, { campo: string; direccion: 'asc' | 'desc' }> = {
  VENTAS: { campo: 'fecha_emision', direccion: 'desc' },
  COMPRAS: { campo: 'fecha_emision', direccion: 'desc' },
  INVENTARIO: { campo: 'stock_disponible', direccion: 'asc' },
};

const LIMITE_MAXIMO = 100;
const LIMITE_DEFECTO = 50;
const MODELO_DEFECTO = 'gemini-2.5-flash';
const TIMEOUT_MS = 15_000;

// Subconjunto de OpenAPI que acepta `responseSchema` de Gemini (generationConfig
// con responseMimeType "application/json"): obliga al modelo a devolver
// exactamente esta forma, sin que el cliente tenga que parsear texto libre.
const ESQUEMA_RESPUESTA = {
  type: 'object',
  properties: {
    reportType: { type: 'string', enum: [...TIPOS_VALIDOS] },
    selectedFields: { type: 'array', items: { type: 'string' } },
    filters: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          campo: { type: 'string' },
          operador: { type: 'string', enum: [...OPERADORES_VALIDOS] },
          valor: { type: 'string' },
        },
        required: ['campo', 'operador', 'valor'],
      },
    },
    sort: {
      type: 'object',
      properties: {
        campo: { type: 'string' },
        direccion: { type: 'string', enum: ['asc', 'desc'] },
      },
    },
    dateFrom: { type: 'string' },
    dateTo: { type: 'string' },
    limit: { type: 'integer' },
    interpretacion: { type: 'string' },
  },
  required: ['reportType', 'selectedFields', 'interpretacion'],
} as const;

/** Lo que Gemini devuelve antes de validar contra el catalogo (nunca se confia tal cual). */
interface RespuestaGeminiBruta {
  reportType?: unknown;
  selectedFields?: unknown;
  filters?: unknown;
  sort?: unknown;
  dateFrom?: unknown;
  dateTo?: unknown;
  limit?: unknown;
  interpretacion?: unknown;
}

/**
 * Interprete de reportes generativos (CU18) basado en la API de Gemini
 * (generativelanguage.googleapis.com), gratuita dentro de su cuota. A
 * diferencia de ReporteNlpService (palabras clave con regex), esto entiende
 * de verdad el lenguaje natural: sinonimos, modismos, pedidos compuestos
 * ("ventas de poleras en Beni el mes pasado, las que mas se vendieron").
 *
 * El modelo nunca ve ni genera SQL: se le entrega el catalogo de campos
 * valido por tipo de reporte (la misma whitelist que usa el Report Builder) y
 * se le pide JSON estructurado con `responseSchema`. Lo que responde se
 * vuelve a validar contra esa whitelist antes de ejecutarse (defensa en
 * profundidad: un modelo que alucina un campo no debe poder filtrar/ordenar
 * por una columna que no existe).
 *
 * Si no hay API key configurada, o la llamada falla, o la respuesta no trae
 * nada usable, se lanza una excepcion: el llamador (ReportsService) es quien
 * decide caer al interprete regex.
 */
@Injectable()
export class GeminiReporteService {
  private readonly logger = new Logger(GeminiReporteService.name);
  private readonly apiKey: string;
  private readonly modelo: string;

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly dataSource: DataSource,
  ) {
    this.apiKey = this.config.get('gemini.apiKey', { infer: true });
    this.modelo = this.config.get('gemini.model', { infer: true }) || MODELO_DEFECTO;
  }

  /** false sin API key: ReportsService ni siquiera intenta llamar a Gemini. */
  get disponible(): boolean {
    return this.apiKey.length > 0;
  }

  async interpretar(promptUsuario: string): Promise<InterpretacionPrompt> {
    if (!this.disponible) {
      throw new Error('GEMINI_API_KEY no esta configurada');
    }

    const sucursales = await this.obtenerSucursalesActivas();
    const cuerpo = {
      system_instruction: { parts: [{ text: this.construirInstrucciones(sucursales) }] },
      contents: [{ role: 'user', parts: [{ text: promptUsuario }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: ESQUEMA_RESPUESTA,
        temperature: 0.2,
      },
    };

    const bruto = await this.llamarGemini(cuerpo);
    return this.normalizar(bruto, sucursales);
  }

  private async llamarGemini(cuerpo: unknown): Promise<RespuestaGeminiBruta> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelo}:generateContent?key=${this.apiKey}`;
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);

    let respuesta: Response;
    try {
      respuesta = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
        signal: controlador.signal,
      });
    } catch (error) {
      throw new Error(`No se pudo contactar a Gemini: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      clearTimeout(temporizador);
    }

    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '');
      throw new Error(`Gemini respondio ${respuesta.status} ${respuesta.statusText}: ${detalle.slice(0, 300)}`);
    }

    const datos = (await respuesta.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
      promptFeedback?: { blockReason?: string };
    };

    if (datos.promptFeedback?.blockReason) {
      throw new Error(`Gemini bloqueo el pedido: ${datos.promptFeedback.blockReason}`);
    }

    const texto = datos.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!texto) {
      throw new Error('Gemini no devolvio contenido utilizable');
    }

    try {
      return JSON.parse(texto) as RespuestaGeminiBruta;
    } catch {
      throw new Error('Gemini no devolvio un JSON valido');
    }
  }

  /** Valida y completa lo que mandó Gemini contra el catálogo real: nunca se confía un campo/tipo a ciegas. */
  private normalizar(bruto: RespuestaGeminiBruta, sucursales: string[]): InterpretacionPrompt {
    const tipo: TipoReporte = TIPOS_VALIDOS.includes(bruto.reportType as TipoReporte) ? (bruto.reportType as TipoReporte) : 'VENTAS';
    const fuente = FUENTES_REPORTE.find((candidata) => candidata.id === tipo) as FuenteReporte;
    const nombresCampo = new Set(fuente.campos.map((campo) => campo.name));

    let selectedFields = Array.isArray(bruto.selectedFields)
      ? bruto.selectedFields.filter((campo): campo is string => typeof campo === 'string' && nombresCampo.has(campo))
      : [];
    if (selectedFields.length === 0) selectedFields = [...CAMPOS_POR_DEFECTO[tipo]];

    const filtrosBrutos = Array.isArray(bruto.filters) ? bruto.filters : [];
    const filters: ReportFilterDto[] = filtrosBrutos
      .filter(
        (filtro): filtro is { campo: string; operador: string; valor: string } =>
          !!filtro &&
          typeof filtro === 'object' &&
          typeof (filtro as Record<string, unknown>).campo === 'string' &&
          nombresCampo.has((filtro as Record<string, unknown>).campo as string) &&
          OPERADORES_VALIDOS.includes((filtro as Record<string, unknown>).operador as (typeof OPERADORES_VALIDOS)[number]),
      )
      .map((filtro) => {
        const campo = fuente.campos.find((candidato) => candidato.name === filtro.campo)!;
        const valor: string | number | boolean =
          campo.tipo === 'BOOLEAN' ? filtro.valor === 'true' : campo.tipo === 'NUMBER' ? Number(filtro.valor) : filtro.valor;
        return { campo: filtro.campo, operador: filtro.operador as ReportFilterDto['operador'], valor };
      });

    const sortBruto = bruto.sort as { campo?: unknown; direccion?: unknown } | undefined;
    const sort =
      sortBruto && typeof sortBruto.campo === 'string' && nombresCampo.has(sortBruto.campo)
        ? { campo: sortBruto.campo, direccion: sortBruto.direccion === 'asc' ? ('asc' as const) : ('desc' as const) }
        : ORDEN_POR_DEFECTO[tipo];

    // INVENTARIO es una foto del stock actual (sin fecha_emision): un rango de fechas ahi no tiene campo al que aplicarse.
    const admiteFechas = fuente.campoFechas !== null;
    const dateFrom = admiteFechas && typeof bruto.dateFrom === 'string' ? bruto.dateFrom : undefined;
    const dateTo = admiteFechas && typeof bruto.dateTo === 'string' ? bruto.dateTo : undefined;

    const limiteNumerico = typeof bruto.limit === 'number' ? bruto.limit : Number(bruto.limit);
    const limit = Number.isFinite(limiteNumerico) && limiteNumerico > 0 ? Math.min(LIMITE_MAXIMO, Math.round(limiteNumerico)) : LIMITE_DEFECTO;

    // Si Gemini no mando una sucursal exacta de la lista real, se descarta ese filtro aparte
    // (nombresCampo mas arriba solo valida el CAMPO, no el VALOR) para no inventar sedes.
    const filtrosFinales = filters.filter((filtro) => filtro.campo !== 'sucursal' || sucursales.includes(String(filtro.valor)));

    const request: ReportRunRequestDto = {
      reportType: tipo,
      selectedFields,
      filters: filtrosFinales,
      sort,
      dateFrom,
      dateTo,
      limit,
      offset: 0,
    };

    const interpretacion =
      typeof bruto.interpretacion === 'string' && bruto.interpretacion.trim().length > 0
        ? bruto.interpretacion.trim()
        : `Reporte de ${fuente.nombre} generado con IA.`;

    return { request, interpretacion };
  }

  private async obtenerSucursalesActivas(): Promise<string[]> {
    const filas = await this.dataSource.query<Array<{ nombre: string }>>('SELECT nombre FROM sucursal WHERE activo = true ORDER BY nombre');
    return filas.map((fila) => fila.nombre);
  }

  private construirInstrucciones(sucursales: string[]): string {
    const catalogo = FUENTES_REPORTE.map((fuente) => this.describirFuente(fuente)).join('\n\n');
    const hoy = new Date().toISOString().slice(0, 10);

    return [
      'Eres el motor de reportes generativos del backoffice de FashionStore (tienda de ropa boliviana, sucursales físicas y e-commerce).',
      'Tu tarea: traducir un pedido en lenguaje natural (texto o transcripción de voz, español, puede traer modismos o errores de dictado) a una configuración JSON de reporte.',
      'Nunca generas SQL ni inventas campos: solo puedes usar los nombres de campo exactos listados en el catálogo de abajo, para el tipo de reporte que elijas.',
      '',
      '=== CATÁLOGO DE REPORTES (única fuente de campos válidos) ===',
      catalogo,
      '',
      `Sucursales activas reales (usa el nombre EXACTO tal cual aparece aquí si el pedido menciona una sede; si no hay coincidencia clara, no agregues filtro de sucursal): ${
        sucursales.length > 0 ? sucursales.join(', ') : '(sin sucursales activas registradas)'
      }`,
      '',
      `Hoy es ${hoy} (zona horaria America/La_Paz). Si el pedido menciona un período relativo ("hoy", "ayer", "esta semana", "el mes pasado", "últimos 15 días", "este año"), calcula dateFrom/dateTo en formato AAAA-MM-DD.`,
      '',
      'Reglas de salida (responde solo el JSON, sin texto adicional):',
      '- reportType: VENTAS, INVENTARIO o COMPRAS, el que mejor corresponda al pedido.',
      '- selectedFields: campos del catálogo del tipo elegido. Incluye al menos una MEASURE si el pedido pide un número/total/monto/cantidad, y las DIMENSION relevantes para agrupar o identificar filas.',
      '- INVENTARIO no tiene fecha (es una foto del stock actual): nunca devuelvas dateFrom/dateTo para ese tipo, aunque el pedido mencione un período (ignóralo).',
      '- filters: opcional. Solo campos del tipo elegido. "valor" siempre como texto; para campos booleanos usa el texto "true" o "false".',
      '- sort: opcional. Si el pedido pide un "top N", "las más vendidas/vendidos" o similar, ordena por la medida relevante en "desc".',
      '- limit: entero entre 1 y 100. Usa el número pedido en un "top N"; si no se especifica, usa 50.',
      '- interpretacion: 1 o 2 frases en español claro, dirigidas al usuario final (sin tecnicismos de SQL/JSON), resumiendo qué reporte armaste y por qué, como si le explicaras lo que entendiste de su pedido.',
    ].join('\n');
  }

  private describirFuente(fuente: FuenteReporte): string {
    const campos = fuente.campos
      .map((campo) => `  - ${campo.name} (${campo.categoria}, ${campo.tipo}): ${campo.label}`)
      .join('\n');
    return `### ${fuente.id} — ${fuente.nombre}\n${fuente.descripcion}\nCampos válidos:\n${campos}`;
  }
}
