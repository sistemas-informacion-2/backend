import { Injectable, Logger } from '@nestjs/common';
import { Type, type FunctionDeclaration, type Schema } from '@google/genai';
import { DataSource } from 'typeorm';
import { ErrorDeParametros, type Fila, type HerramientaRegistrada, type ParametroEsquema, type ResultadoHerramienta } from './herramienta.js';
import { HERRAMIENTAS_INVENTARIO } from './inventario.herramientas.js';
import { MlClienteService } from './ml-cliente.service.js';
import { HERRAMIENTAS_MODELOS } from './modelos.herramientas.js';
import { HERRAMIENTAS_NEGOCIO } from './negocio.herramientas.js';
import { HERRAMIENTAS_VENTAS } from './ventas.herramientas.js';

const MAX_FILAS = 200;
const TIMEOUT_CONSULTA_MS = 10_000;

export interface EjecucionHerramienta {
  nombre: string;
  parametros: Record<string, unknown>;
  ok: boolean;
  /** Completo, para la pantalla. */
  resultado: ResultadoHerramienta | { error: string };
  /** Lo que se le manda a Gemini: sin datos personales y con un tope de filas. */
  paraModelo: Record<string, unknown>;
}

const TIPOS_GEMINI: Record<ParametroEsquema['tipo'], Type> = { string: Type.STRING, integer: Type.INTEGER, number: Type.NUMBER };

function fechaValida(texto: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const fecha = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === texto;
}

/**
 * Registro unico de las herramientas del agente: nombre, descripcion, parametros y consulta. El mismo formato sirve
 * para exponerlas despues por MCP. Gemini solo elige herramienta y parametros; el SQL es fijo y la empresa sale del token.
 */
@Injectable()
export class RegistroHerramientas {
  private readonly logger = new Logger(RegistroHerramientas.name);
  private readonly herramientas: Map<string, HerramientaRegistrada>;

  constructor(
    private readonly dataSource: DataSource,
    private readonly ml: MlClienteService,
  ) {
    const todas = [...HERRAMIENTAS_VENTAS, ...HERRAMIENTAS_INVENTARIO, ...HERRAMIENTAS_MODELOS, ...HERRAMIENTAS_NEGOCIO] as unknown as HerramientaRegistrada[];
    this.herramientas = new Map(todas.map((herramienta) => [herramienta.nombre, herramienta]));
  }

  nombres(): string[] {
    return [...this.herramientas.keys()];
  }

  declaraciones(): FunctionDeclaration[] {
    return [...this.herramientas.values()].map((herramienta) => {
      const propiedades = Object.entries(herramienta.parametros);
      const parameters: Schema | undefined =
        propiedades.length === 0
          ? undefined
          : {
              type: Type.OBJECT,
              properties: Object.fromEntries(
                propiedades.map(([nombre, p]) => [
                  nombre,
                  {
                    type: TIPOS_GEMINI[p.tipo],
                    description: p.descripcion,
                    ...(p.enum ? { enum: [...p.enum] } : {}),
                    ...(p.minimo !== undefined ? { minimum: p.minimo } : {}),
                    ...(p.maximo !== undefined ? { maximum: p.maximo } : {}),
                  } satisfies Schema,
                ]),
              ),
              required: herramienta.requeridos ? [...herramienta.requeridos] : [],
            };
      return { name: herramienta.nombre, description: herramienta.descripcion, ...(parameters ? { parameters } : {}) };
    });
  }

  /** Nunca lanza: un error vuelve como resultado, para que el asistente lo corrija o lo informe. */
  async ejecutar(nombre: string, argumentos: Record<string, unknown>, idEmpresa: number, hoy: string): Promise<EjecucionHerramienta> {
    const parametros = argumentos ?? {};
    const herramienta = this.herramientas.get(nombre);
    const fallo = (error: string): EjecucionHerramienta => ({ nombre, parametros, ok: false, resultado: { error }, paraModelo: { error } });
    if (!herramienta) return fallo(`La herramienta ${nombre} no existe`);
    try {
      this.validar(herramienta, parametros);
      const resultado = await this.dataSource.transaction(async (manager) => {
        await manager.query('SET TRANSACTION READ ONLY');
        await manager.query(`SET LOCAL statement_timeout = ${TIMEOUT_CONSULTA_MS}`);
        return herramienta.ejecutar(parametros as never, {
          idEmpresa,
          hoy,
          consultar: (sql, valores) => manager.query<Fila[]>(sql, valores),
          ml: this.ml,
        });
      });
      return { nombre, parametros, ok: true, resultado, paraModelo: this.paraModelo(resultado) };
    } catch (error) {
      if (error instanceof ErrorDeParametros) return fallo(error.message);
      this.logger.error(`La herramienta ${nombre} fallo: ${error instanceof Error ? error.message : String(error)}`);
      return fallo('No se pudo obtener el dato por un error interno');
    }
  }

  private validar(herramienta: HerramientaRegistrada, argumentos: Record<string, unknown>): void {
    for (const requerido of herramienta.requeridos ?? []) {
      if (argumentos[requerido] === undefined || argumentos[requerido] === null) throw new ErrorDeParametros(`Falta el parametro ${requerido}`);
    }
    for (const [nombre, valor] of Object.entries(argumentos)) {
      const esquema = herramienta.parametros[nombre];
      // Tambien frena que la IA intente mandar id_empresa u otro dato que no le corresponde.
      if (!esquema) throw new ErrorDeParametros(`Parametro no permitido: ${nombre}`);
      if (valor === null || valor === undefined) continue;
      if (esquema.tipo === 'string' && typeof valor !== 'string') throw new ErrorDeParametros(`${nombre} debe ser texto`);
      if (esquema.tipo === 'integer' && !Number.isInteger(valor)) throw new ErrorDeParametros(`${nombre} debe ser un entero`);
      if (esquema.tipo === 'number' && typeof valor !== 'number') throw new ErrorDeParametros(`${nombre} debe ser un numero`);
      if (typeof valor === 'string' && valor.length > 100) throw new ErrorDeParametros(`${nombre} es demasiado largo`);
      if (esquema.enum && !esquema.enum.includes(valor as string)) throw new ErrorDeParametros(`${nombre} debe ser uno de: ${esquema.enum.join(', ')}`);
      if (esquema.fecha && !fechaValida(valor as string)) throw new ErrorDeParametros(`${nombre} debe ser una fecha AAAA-MM-DD valida`);
      if (typeof valor === 'number' && esquema.minimo !== undefined && valor < esquema.minimo) throw new ErrorDeParametros(`${nombre} debe ser al menos ${esquema.minimo}`);
      if (typeof valor === 'number' && esquema.maximo !== undefined && valor > esquema.maximo) throw new ErrorDeParametros(`${nombre} debe ser como maximo ${esquema.maximo}`);
    }
  }

  private paraModelo(resultado: ResultadoHerramienta): Record<string, unknown> {
    const privadas = new Set(resultado.columnasPrivadas ?? []);
    const filas = resultado.filas.slice(0, MAX_FILAS).map((fila) => Object.fromEntries(Object.entries(fila).filter(([columna]) => !privadas.has(columna))));
    return {
      filas,
      total_filas: resultado.filas.length,
      ...(resultado.filas.length > MAX_FILAS ? { aviso: `Se muestran solo ${MAX_FILAS} filas: pide un periodo mas corto o una agrupacion mayor` } : {}),
      ...(resultado.resumen ? { resumen: resultado.resumen } : {}),
      ...(resultado.nota ? { nota: resultado.nota } : {}),
      ...(resultado.disponible === false ? { disponible: false } : {}),
    };
  }
}
