import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Type, type Schema } from '@google/genai';
import { DataSource } from 'typeorm';
import { fechaLocal } from '../../../common/utils/fecha.util.js';
import { TenantContext } from '../../../common/tenant/tenant-context.service.js';
import type { AppConfig } from '../../../config/configuration.js';
import { GeminiBiClient } from '../../bi/agente/gemini.client.js';
import {
  FUENTES_REPORTE,
  OPERADORES_POR_TIPO,
  normalizarTexto,
  type CampoReporte,
  type FuenteReporte,
  type OperadorFiltro,
} from '../catalog/reporte-catalog.constants.js';
import { LIMITE_REPORTE_MAXIMO, type ReportFilterDto, type ReportRunRequestDto } from '../dto/reporte-builder.dto.js';
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

/** Columnas que hacen que el reporte liste notas de venta (una fila por nota), no clientes. */
const CAMPOS_DE_NOTA = ['codigo_nota', 'id_nota'];

/** Filas por pagina del generativo (la tabla pagina; el top, si lo hay, acota el reporte). */
const LIMITE_DEFECTO = 50;
const MODELO_DEFECTO = 'gemini-3.5-flash-lite';
/** Pausa antes del unico reintento ante un 503 "high demand" (el propio Google recomienda reintentar, no es error nuestro ni de la cuenta). */
const REINTENTO_ESPERA_MS = 1_500;
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

// Esquema de la respuesta (responseSchema): obliga al modelo a devolver exactamente esta forma, sin que haya que
// parsear texto libre. Usa los tipos del SDK, que entienden tanto Vertex AI como AI Studio.
const ESQUEMA_RESPUESTA: Schema = {
  type: Type.OBJECT,
  properties: {
    reportType: { type: Type.STRING, enum: [...TIPOS_VALIDOS] },
    selectedFields: { type: Type.ARRAY, items: { type: Type.STRING } },
    filters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          campo: { type: Type.STRING },
          operador: { type: Type.STRING, enum: [...OPERADORES_VALIDOS] },
          valor: { type: Type.STRING },
        },
        required: ['campo', 'operador', 'valor'],
      },
    },
    sort: {
      type: Type.OBJECT,
      properties: {
        campo: { type: Type.STRING },
        direccion: { type: Type.STRING, enum: ['asc', 'desc'] },
      },
    },
    dateFrom: { type: Type.STRING },
    dateTo: { type: Type.STRING },
    top: { type: Type.INTEGER },
    interpretacion: { type: Type.STRING },
  },
  required: ['reportType', 'selectedFields', 'interpretacion'],
};

/** Lo que Gemini devuelve antes de validar contra el catalogo (nunca se confia tal cual). */
interface RespuestaGeminiBruta {
  reportType?: unknown;
  selectedFields?: unknown;
  filters?: unknown;
  sort?: unknown;
  dateFrom?: unknown;
  dateTo?: unknown;
  top?: unknown;
  interpretacion?: unknown;
}

/**
 * Interprete de reportes generativos (CU18) con Gemini. Entiende de verdad el lenguaje natural: sinonimos, modismos,
 * pedidos compuestos ("ventas de poleras en Beni el mes pasado, las que mas se vendieron").
 *
 * Usa el mismo cliente que el asistente del BI (GeminiBiClient): Vertex AI si hay proyecto de Google Cloud (en la VM,
 * con la identidad de la maquina y sin llaves), o Google AI Studio con GEMINI_API_KEY si no. Lo decide
 * BI_IA_PROVEEDOR. El modelo es el de los reportes (GEMINI_MODEL), no el del BI.
 *
 * El modelo nunca ve ni genera SQL: se le entrega el catalogo de campos valido por tipo de reporte (la misma whitelist
 * que usa el Report Builder) y se le pide JSON con `responseSchema`. Lo que responde se corrige contra esa whitelist
 * antes de ejecutarse: campos, operadores, valores, fechas y orden. Si la llamada falla o no trae nada usable, se lanza
 * una excepcion y ReportsService usa el interprete por palabras clave.
 */
@Injectable()
export class GeminiReporteService {
  private readonly logger = new Logger(GeminiReporteService.name);
  private readonly modelo: string;

  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly dataSource: DataSource,
    private readonly tenant: TenantContext,
    private readonly ia: GeminiBiClient,
  ) {
    this.modelo = config.get('gemini.model', { infer: true }) || MODELO_DEFECTO;
  }

  /** false si no hay ni Vertex ni API key: ReportsService ni siquiera intenta llamar a Gemini. */
  get disponible(): boolean {
    return this.ia.modo() !== 'SIN_CONFIGURAR';
  }

  async interpretar(promptUsuario: string): Promise<InterpretacionPrompt> {
    if (!this.disponible) {
      throw new Error('Gemini no esta configurado (ni Vertex AI ni GEMINI_API_KEY)');
    }

    const sucursales = await this.obtenerSucursalesActivas();
    const bruto = await this.llamarGeminiConReintento(promptUsuario, this.construirInstrucciones(sucursales));
    return this.normalizar(bruto, sucursales, promptUsuario);
  }

  /**
   * Un 503 "high demand" es la única falla que el propio Google recomienda reintentar tal cual (no es un error de la
   * cuenta ni de la configuracion): se da una sola segunda oportunidad, con una pausa corta, antes de rendirse. Para
   * cualquier otro error (403, 404, timeout, JSON inválido...) reintentar de inmediato no cambia nada.
   */
  private async llamarGeminiConReintento(prompt: string, instrucciones: string): Promise<RespuestaGeminiBruta> {
    try {
      return await this.llamarGemini(prompt, instrucciones);
    } catch (error) {
      if ((error as { status?: unknown }).status !== 503) throw error;
      this.logger.warn('Gemini respondio 503 (alta demanda); reintentando una vez...');
      await new Promise((resolve) => setTimeout(resolve, REINTENTO_ESPERA_MS));
      return this.llamarGemini(prompt, instrucciones);
    }
  }

  private async llamarGemini(prompt: string, instrucciones: string): Promise<RespuestaGeminiBruta> {
    const respuesta = await this.ia.generar({
      model: this.modelo,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: instrucciones,
        responseMimeType: 'application/json',
        responseSchema: ESQUEMA_RESPUESTA,
        temperature: 0.2,
      },
    });

    if (respuesta.promptFeedback?.blockReason) {
      throw new Error(`Gemini bloqueo el pedido: ${respuesta.promptFeedback.blockReason}`);
    }
    const texto = respuesta.text;
    if (!texto) {
      throw new Error('Gemini no devolvio contenido utilizable');
    }
    try {
      return JSON.parse(texto) as RespuestaGeminiBruta;
    } catch {
      throw new Error('Gemini no devolvio un JSON valido');
    }
  }

  /**
   * Corrige lo que mandó Gemini contra el catálogo real: nunca se confía un campo, tipo, operador o valor a ciegas.
   * Lo que no sirve se descarta (un filtro con un número inválido, una fecha mal escrita) en vez de hacer fallar todo
   * el reporte con un 400.
   */
  private normalizar(bruto: RespuestaGeminiBruta, sucursales: string[], promptUsuario: string): InterpretacionPrompt {
    const tipo: TipoReporte = TIPOS_VALIDOS.includes(bruto.reportType as TipoReporte) ? (bruto.reportType as TipoReporte) : 'VENTAS';
    const fuente = FUENTES_REPORTE.find((candidata) => candidata.id === tipo) as FuenteReporte;
    const campoPorNombre = new Map(fuente.campos.map((campo) => [campo.name, campo]));

    let selectedFields = Array.isArray(bruto.selectedFields)
      ? [...new Set(bruto.selectedFields.filter((campo): campo is string => typeof campo === 'string' && campoPorNombre.has(campo)))]
      : [];
    if (selectedFields.length === 0) selectedFields = [...CAMPOS_POR_DEFECTO[tipo]];

    const filters = (Array.isArray(bruto.filters) ? bruto.filters : [])
      .map((filtro) => this.filtroValido(filtro, campoPorNombre))
      .filter((filtro): filtro is ReportFilterDto => filtro !== null)
      // Si Gemini no mando una sucursal exacta de la lista real, se descarta ese filtro: no debe inventar sedes.
      .filter((filtro) => filtro.campo !== 'sucursal' || sucursales.includes(String(filtro.valor)));

    const sort = this.ordenValido(bruto.sort, tipo, selectedFields, campoPorNombre);

    // INVENTARIO es una foto del stock actual (sin fecha_emision): un rango de fechas ahi no tiene campo al que aplicarse.
    const admiteFechas = fuente.campoFechas !== null;
    const dateFrom = admiteFechas ? fechaValida(bruto.dateFrom) : undefined;
    const dateTo = admiteFechas ? fechaValida(bruto.dateTo) : undefined;

    // "Los 20 clientes...": un tope de filas, no un tamano de pagina. Si Gemini no lo mando, se busca en el pedido.
    const topNumerico = typeof bruto.top === 'number' ? bruto.top : Number(bruto.top);
    const top = Number.isFinite(topNumerico) && topNumerico > 0 ? Math.min(LIMITE_REPORTE_MAXIMO, Math.round(topNumerico)) : topDelPedido(promptUsuario);

    // En un ranking de CLIENTES (agrupado por cliente), "Consumidor Final" (las ventas sin cliente identificado) no es
    // un cliente y saldria primero por lejos. Se excluye, salvo que el pedido ya filtre por ese campo. Si el reporte
    // lista notas de venta (una fila por nota), no: la venta mas grande puede haber sido a un cliente sin identificar.
    const listaNotas = selectedFields.some((campo) => CAMPOS_DE_NOTA.includes(campo));
    const sinConsumidorFinal =
      tipo === 'VENTAS' &&
      selectedFields.includes('cliente') &&
      !listaNotas &&
      (top !== undefined || sort.direccion === 'desc') &&
      !filters.some((f) => f.campo === 'cliente_identificado');
    if (sinConsumidorFinal) filters.push({ campo: 'cliente_identificado', operador: 'eq', valor: true });

    const request: ReportRunRequestDto = {
      reportType: tipo,
      selectedFields,
      filters,
      sort,
      // Un rango al reves (desde despues de hasta) no trae nada: se ordena.
      ...(dateFrom && dateTo && dateFrom > dateTo ? { dateFrom: dateTo, dateTo: dateFrom } : { dateFrom, dateTo }),
      // La pagina es de a 50 (o el top entero si es menor); el top acota el reporte.
      limit: top ? Math.min(top, LIMITE_DEFECTO) : LIMITE_DEFECTO,
      offset: 0,
      ...(top ? { top } : {}),
    };

    const base =
      typeof bruto.interpretacion === 'string' && bruto.interpretacion.trim().length > 0
        ? bruto.interpretacion.trim()
        : `Reporte de ${fuente.nombre} generado con IA.`;
    const interpretacion = sinConsumidorFinal ? `${base} No incluye las ventas a «Consumidor Final» (clientes sin identificar).` : base;

    return { request, interpretacion };
  }

  /** El filtro corregido, o null si no se puede usar: campo inexistente, operador que no aplica o valor invalido. */
  private filtroValido(filtro: unknown, campoPorNombre: Map<string, CampoReporte>): ReportFilterDto | null {
    if (!filtro || typeof filtro !== 'object') return null;
    const { campo: nombre, operador, valor } = filtro as Record<string, unknown>;
    const campo = typeof nombre === 'string' ? campoPorNombre.get(nombre) : undefined;
    if (!campo || !OPERADORES_POR_TIPO[campo.tipo].includes(operador as OperadorFiltro)) return null;

    const texto = typeof valor === 'string' ? valor.trim() : String(valor ?? '').trim();
    if (campo.tipo === 'BOOLEAN') {
      if (texto !== 'true' && texto !== 'false') return null;
      return { campo: campo.name, operador: operador as OperadorFiltro, valor: texto === 'true' };
    }
    if (campo.tipo === 'NUMBER') {
      const numero = Number(texto.replace(',', '.'));
      if (texto === '' || !Number.isFinite(numero)) return null;
      return { campo: campo.name, operador: operador as OperadorFiltro, valor: numero };
    }
    if (campo.tipo === 'DATE') {
      const fecha = fechaValida(texto);
      return fecha ? { campo: campo.name, operador: operador as OperadorFiltro, valor: fecha } : null;
    }
    return texto ? { campo: campo.name, operador: operador as OperadorFiltro, valor: texto } : null;
  }

  /**
   * Un orden que el constructor acepte. Con medidas en el reporte, el orden tiene que ser por una medida o por una
   * columna incluida; si el de Gemini (o el por defecto) no cumple, se ordena por la primera medida, de mayor a menor.
   */
  private ordenValido(
    sortBruto: unknown,
    tipo: TipoReporte,
    selectedFields: string[],
    campoPorNombre: Map<string, CampoReporte>,
  ): { campo: string; direccion: 'asc' | 'desc' } {
    const hayMedidas = selectedFields.some((nombre) => campoPorNombre.get(nombre)?.categoria === 'MEASURE');
    const sirve = (nombre: string): boolean => {
      const campo = campoPorNombre.get(nombre);
      if (!campo || campo.tipo === 'BOOLEAN') return false;
      return !hayMedidas || campo.categoria === 'MEASURE' || selectedFields.includes(nombre);
    };

    const pedido = sortBruto as { campo?: unknown; direccion?: unknown } | undefined;
    if (pedido && typeof pedido.campo === 'string' && sirve(pedido.campo)) {
      return { campo: pedido.campo, direccion: pedido.direccion === 'asc' ? 'asc' : 'desc' };
    }
    if (sirve(ORDEN_POR_DEFECTO[tipo].campo)) return ORDEN_POR_DEFECTO[tipo];
    const primeraMedida = selectedFields.find((nombre) => campoPorNombre.get(nombre)?.categoria === 'MEASURE');
    if (primeraMedida) return { campo: primeraMedida, direccion: 'desc' };
    // Sin medidas, cualquier columna elegida que se pueda ordenar.
    return { campo: selectedFields.find(sirve) ?? selectedFields[0], direccion: 'asc' };
  }

  private async obtenerSucursalesActivas(): Promise<string[]> {
    const filas = await this.dataSource.query<Array<{ nombre: string }>>(
      'SELECT nombre FROM sucursal WHERE activo = true AND id_empresa = $1 ORDER BY nombre',
      [this.tenant.empresaId()],
    );
    return filas.map((fila) => fila.nombre);
  }

  private construirInstrucciones(sucursales: string[]): string {
    const catalogo = FUENTES_REPORTE.map((fuente) => this.describirFuente(fuente)).join('\n\n');
    const hoy = fechaLocal();
    // Cada empresa del SaaS es una tienda distinta: Gemini debe saber de cual es el backoffice.
    const tienda = this.tenant.empresa()?.nombre ?? 'la tienda';

    return [
      `Eres el motor de reportes generativos del backoffice de ${tienda} (tienda de ropa boliviana, sucursales físicas y e-commerce).`,
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
      `Hoy es ${hoy} (zona horaria America/La_Paz). Si el pedido menciona un período relativo ("hoy", "ayer", "esta semana", "el mes pasado", "últimos 15 días", "este año"), calcula dateFrom/dateTo en formato AAAA-MM-DD. "El mes pasado" es el mes calendario anterior completo.`,
      '',
      'Reglas de salida (responde solo el JSON, sin texto adicional):',
      '- reportType: VENTAS, INVENTARIO o COMPRAS, el que mejor corresponda al pedido.',
      '- selectedFields: campos del catálogo del tipo elegido. Incluye al menos una MEASURE si el pedido pide un número/total/monto/cantidad, y las DIMENSION relevantes para agrupar o identificar filas.',
      '- INVENTARIO no tiene fecha (es una foto del stock actual): nunca devuelvas dateFrom/dateTo para ese tipo, aunque el pedido mencione un período (ignóralo).',
      '- filters: opcional. Solo campos del tipo elegido. "valor" siempre como texto; para campos booleanos usa el texto "true" o "false". Para buscar un producto o una categoría por su nombre usa el operador "contains".',
      '- sort: si el pedido pide un "top N", "las más vendidas/vendidos" o similar, ordena por la medida relevante en "desc". Si ordenas por una DIMENSION, inclúyela en selectedFields.',
      '- top: entero entre 1 y 500, SOLO si el pedido pide una cantidad de filas ("los 20 clientes con más compras", "top 10", "las 5 prendas más vendidas"). Si no pide una cantidad, no lo envíes.',
      '- Para rankings de clientes, el cliente "Consumidor Final" agrupa las ventas sin cliente identificado: no es un cliente real.',
      '- interpretacion: 1 o 2 frases en español claro, dirigidas al usuario final (sin tecnicismos de SQL/JSON), resumiendo qué reporte armaste y por qué, como si le explicaras lo que entendiste de su pedido.',
    ].join('\n');
  }

  private describirFuente(fuente: FuenteReporte): string {
    const campos = fuente.campos.map((campo) => `  - ${campo.name} (${campo.categoria}, ${campo.tipo}): ${campo.label}`).join('\n');
    return `### ${fuente.id} — ${fuente.nombre}\n${fuente.descripcion}\nCampos válidos:\n${campos}`;
  }
}

/**
 * El "top N" escrito en el pedido, para cuando Gemini no lo devuelve: "los 20 clientes", "las 5 prendas", "top 10".
 * undefined si no hay una cantidad clara.
 */
export function topDelPedido(prompt: string): number | undefined {
  const texto = normalizarTexto(prompt);
  // "los 3 meses" o "los 15 ultimos dias" son un periodo, no un top.
  const periodo = String.raw`(?!\s*(?:ultim[oa]s\s+)?(?:dias?|semanas?|mes(?:es)?|anos?|horas?)\b)`;
  const coincidencia = texto.match(new RegExp(String.raw`\btop\s*(\d{1,3})\b`)) ?? texto.match(new RegExp(String.raw`\b(?:l[ao]s|primer[oa]s)\s+(\d{1,3})\b${periodo}`));
  const numero = coincidencia ? Number(coincidencia[1]) : NaN;
  return Number.isInteger(numero) && numero > 0 ? Math.min(numero, LIMITE_REPORTE_MAXIMO) : undefined;
}

/** La fecha si es AAAA-MM-DD y existe en el calendario; undefined si no. */
function fechaValida(valor: unknown): string | undefined {
  if (typeof valor !== 'string' || !FECHA_ISO.test(valor)) return undefined;
  const [anio, mes, dia] = valor.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia ? valor : undefined;
}
