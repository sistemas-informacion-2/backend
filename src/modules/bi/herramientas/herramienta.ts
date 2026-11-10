import type { MlClienteService } from './ml-cliente.service.js';

export type Fila = Record<string, unknown>;

export interface ContextoHerramienta {
  /** Sale siempre del token del usuario: la IA no puede elegirla. */
  idEmpresa: number;
  /** Hoy en La Paz, AAAA-MM-DD. */
  hoy: string;
  /** SELECT en una transaccion de solo lectura. */
  consultar: (sql: string, parametros: unknown[]) => Promise<Fila[]>;
  ml: MlClienteService;
}

export interface ResultadoHerramienta {
  filas: Fila[];
  /** Totales o datos de contexto del resultado. */
  resumen?: Fila;
  /** Aclaracion para que el asistente no interprete de mas. */
  nota?: string;
  /** false: el dato no existe todavia (por ejemplo, modelos sin entrenar). */
  disponible?: boolean;
  /** Columnas que van a la pantalla pero no a Google (datos personales). */
  columnasPrivadas?: string[];
}

/** Como se dibuja el resultado de una herramienta. Sale de reglas fijas: no cuesta tokens y Gemini no puede alterarlo. */
export interface Visual {
  titulo: string;
  tipo: 'linea' | 'barras' | 'torta' | 'tabla';
  /** Columna del eje X o de las etiquetas. */
  x?: string;
  /** Columnas numericas a dibujar. */
  series?: string[];
  /** Columnas del rango de un pronostico. */
  rango?: { bajo: string; alto: string };
}

export interface ParametroEsquema {
  tipo: 'string' | 'integer' | 'number';
  descripcion: string;
  enum?: readonly string[];
  /** AAAA-MM-DD valida. */
  fecha?: boolean;
  minimo?: number;
  maximo?: number;
}

export interface Herramienta<A = Record<string, never>> {
  nombre: string;
  /** Gemini elige la herramienta leyendo esto: dice que responde y que no. */
  descripcion: string;
  parametros: Record<string, ParametroEsquema>;
  requeridos?: readonly string[];
  /** Grafico que le corresponde al resultado, segun los argumentos. */
  visual?: (argumentos: A) => Visual | null;
  ejecutar: (argumentos: A, contexto: ContextoHerramienta) => Promise<ResultadoHerramienta>;
}

/** Herramientas de tipos distintos en una misma lista. */
export type HerramientaRegistrada = Herramienta<never>;

/** Un parametro invalido: el mensaje vuelve a Gemini para que corrija el pedido. */
export class ErrorDeParametros extends Error {}

export const DESDE: ParametroEsquema = { tipo: 'string', fecha: true, descripcion: 'Inicio del periodo, AAAA-MM-DD' };
export const HASTA: ParametroEsquema = { tipo: 'string', fecha: true, descripcion: 'Fin del periodo (incluido), AAAA-MM-DD' };
export const SUCURSAL: ParametroEsquema = { tipo: 'string', descripcion: 'Parte del nombre de la sucursal. Omitir para todas' };
export const CATEGORIA: ParametroEsquema = { tipo: 'string', descripcion: 'Parte del nombre de la categoria. Omitir para todas' };
export const LIMITE: ParametroEsquema = { tipo: 'integer', descripcion: 'Maximo de filas', minimo: 1, maximo: 100 };

/** Arma una consulta con todos los valores como parametros ($n). $1 es siempre la empresa. */
export class Consulta {
  readonly parametros: unknown[];

  constructor(idEmpresa: number) {
    this.parametros = [idEmpresa];
  }

  valor(valor: unknown): string {
    this.parametros.push(valor);
    return `$${this.parametros.length}`;
  }

  fecha(valor: string): string {
    return `${this.valor(valor)}::date`;
  }

  entero(valor: number): string {
    return `${this.valor(valor)}::int`;
  }

  /** Condicion ILIKE con el texto tomado literal: % y _ no actuan como comodines. */
  contiene(columna: string, texto: string): string {
    return `${columna} ILIKE ${this.valor(`%${texto.replace(/[\\%_]/g, '\\$&')}%`)}`;
  }
}

export function validarRango(desde: string, hasta: string): void {
  if (desde > hasta) throw new ErrorDeParametros(`El periodo es invalido: ${desde} es posterior a ${hasta}`);
}

const AGRUPACIONES_DE_TIEMPO = new Set(['dia', 'semana', 'mes', 'trimestre', 'anio']);
const AGRUPACIONES_DE_PARTES = new Set(['canal', 'metodo_pago', 'temporada']);

/** Linea si el eje es tiempo, torta si son pocas partes de un todo, barras en lo demas; sin grafico si es un total. */
export function visualAgrupado(titulo: string, agrupacion: string | undefined, series: string[]): Visual | null {
  if (!agrupacion || agrupacion === 'total') return null;
  const tipo = AGRUPACIONES_DE_TIEMPO.has(agrupacion) ? 'linea' : AGRUPACIONES_DE_PARTES.has(agrupacion) ? 'torta' : 'barras';
  const nombre = agrupacion === 'anio' ? 'año' : agrupacion.replace(/_/g, ' ');
  return { titulo: `${titulo} por ${nombre}`, tipo, x: 'grupo', series };
}

/** Expresion SQL de una opcion de agrupacion; los nombres vienen de un enum ya validado, nunca del texto del modelo. */
export function expresion(mapa: Record<string, string>, clave: string): string {
  const sql = mapa[clave];
  if (sql === undefined) throw new ErrorDeParametros(`Agrupacion no valida: ${clave}`);
  return sql;
}

/** Filas de resultados de los modelos, avisando si todavia no se entrenaron. */
export async function conAvisoDeModelos(contexto: ContextoHerramienta, filas: Fila[], extra: Partial<ResultadoHerramienta> = {}): Promise<ResultadoHerramienta> {
  if (filas.length > 0) return { filas, ...extra };
  const [ultima] = await contexto.consultar(`SELECT estado FROM dw.ml_ejecucion WHERE id_empresa = $1 ORDER BY id DESC LIMIT 1`, [contexto.idEmpresa]);
  if (!ultima) {
    return { filas: [], disponible: false, nota: 'Los modelos de machine learning todavia no se entrenaron para esta empresa. No inventes un resultado: dilo asi.' };
  }
  return { filas: [], nota: 'Los modelos se entrenaron, pero no hay resultados para este pedido (filtros sin coincidencias o historia insuficiente).' };
}
