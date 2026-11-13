import { BadRequestException, Injectable } from '@nestjs/common';
import { fechaDeColumna } from '../../../common/utils/fecha.util.js';
import { DataSource } from 'typeorm';
import { TenantContext } from '../../../common/tenant/tenant-context.service.js';
import {
  OPERADORES_POR_TIPO,
  OPERADOR_SQL,
  buscarFuente,
  campoDe,
  validarFechaIso,
  type CampoReporte,
  type OperadorFiltro,
} from '../catalog/reporte-catalog.constants.js';
import { FUENTES_REPORTE } from '../catalog/reporte-catalog.constants.js';
import {
  LIMITE_REPORTE_MAXIMO,
  type FormatoColumna,
  type ReportResultDto,
  type ReportRunRequestDto,
  type ReportTypeDefinitionDto,
} from '../dto/reporte-builder.dto.js';

const LIMITE_POR_DEFECTO = 25;
const OPERADORES_DIRECTOS: ReadonlySet<OperadorFiltro> = new Set(['eq', 'ne', 'gt', 'gte', 'lt', 'lte']);
/** Numero escrito como texto: entero o decimal con punto o coma, con signo opcional. */
const NUMERO_EN_TEXTO = /^-?\d+([.,]\d+)?$/;

/** Como mostrar cada columna: alinear numeros a la derecha y poner "Bs." al dinero (tabla, PDF y Excel). */
function formatoDe(campo: CampoReporte): FormatoColumna {
  if (campo.moneda) return 'MONEDA';
  return ({ NUMBER: 'NUMERO', DATE: 'FECHA', BOOLEAN: 'BOOLEANO', STRING: 'TEXTO' } as const)[campo.tipo];
}

/**
 * Ejecuta las consultas del Report Builder (CU18) usando el catálogo de
 * reportes como whitelist. Todo valor llega como parámetro ($n) y toda
 * columna sale de la metadata transpilada en `reporte-catalog.constants.ts`;
 * el cliente nunca aporta SQL.
 */
@Injectable()
export class ReportBuilderService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenant: TenantContext,
  ) {}

  catalogo(): ReportTypeDefinitionDto[] {
    return FUENTES_REPORTE.map((fuente) => ({
      id: fuente.id,
      nombre: fuente.nombre,
      descripcion: fuente.descripcion,
      campos: fuente.campos.map((campo) => ({
        name: campo.name,
        label: campo.label,
        categoria: campo.categoria,
        tipo: campo.tipo,
        permiteFiltro: true,
        permiteOrden: campo.tipo !== 'BOOLEAN',
        moneda: campo.moneda === true,
        operadores: [...OPERADORES_POR_TIPO[campo.tipo]],
      })),
    }));
  }

  /** Nombre legible de un tipo de reporte (para nombres de archivo de exportación). */
  nombreTipo(tipoReporte: string): string {
    return buscarFuente(tipoReporte).nombre;
  }

  /**
   * Revisa una configuracion sin tocar la base: lanza BadRequestException (400) si no se puede ejecutar. Lo usa el
   * generativo para descartar una configuracion de Gemini invalida y usar el interprete de respaldo.
   */
  validar(request: ReportRunRequestDto): void {
    this.armarConsulta(request);
  }

  async ejecutar(request: ReportRunRequestDto): Promise<ReportResultDto> {
    const consulta = this.armarConsulta(request);
    const total = await this.contar(consulta.fromSql, consulta.whereSql, consulta.groupExprs, consulta.agregar, consulta.params);

    const params = [...consulta.params, consulta.limites.limit, consulta.limites.offset];
    const sql = `${consulta.sql} LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const filas = await this.dataSource.query<Array<Record<string, unknown>>>(sql, params);

    return {
      columns: request.selectedFields,
      columnLabels: consulta.campos.map((campo) => campo.label),
      columnFormats: consulta.campos.map(formatoDe),
      rows: filas.map((fila) => request.selectedFields.map((name) => this.serializar(fila[name]))),
      total,
    };
  }

  /** Valida la configuracion y arma el SQL (sin LIMIT/OFFSET). No consulta la base. */
  private armarConsulta(request: ReportRunRequestDto) {
    const fuente = buscarFuente(request.reportType);

    const joinsRequeridos = new Set<string>(fuente.joinsSiempre);
    const campos = request.selectedFields.map((name) => {
      const campo = campoDe(fuente, name);
      for (const join of campo.joins) joinsRequeridos.add(join);
      return campo;
    });

    const agregar = campos.some((campo) => campo.categoria === 'MEASURE');
    const claves = campos.filter((campo) => campo.categoria !== 'MEASURE');

    const whereFechas: string[] = [];
    const whereFiltros: string[] = [];
    const params: unknown[] = [];
    const agregarValor = (valor: unknown): number => {
      params.push(valor);
      return params.length;
    };
    const clausula = (base: string, simbolo: string, valor: unknown): string => `${base} ${simbolo} $${agregarValor(valor)}`;

    for (const filtro of request.filters ?? []) {
      const campo = campoDe(fuente, filtro.campo);
      for (const join of campo.joins) joinsRequeridos.add(join);
      if (!OPERADORES_POR_TIPO[campo.tipo].includes(filtro.operador)) {
        throw new BadRequestException(
          `El operador "${filtro.operador}" no aplica al campo "${campo.label}" (${campo.tipo})`,
        );
      }
      const valor = this.coercionDeValor(campo, filtro.valor);
      if (OPERADORES_DIRECTOS.has(filtro.operador)) {
        const simbolo = OPERADOR_SQL[filtro.operador as Exclude<OperadorFiltro, 'contains' | 'startsWith' | 'endsWith'>];
        // El texto se compara sin distinguir mayusculas: "poleras" encuentra la categoria "Poleras".
        whereFiltros.push(
          campo.tipo === 'STRING' ? `LOWER(${campo.sql}) ${simbolo} LOWER($${agregarValor(valor)})` : clausula(campo.sql, simbolo, valor),
        );
      } else {
        // El % y el _ que escribe el usuario son letras, no comodines de LIKE.
        const literal = String(valor).replace(/[\\%_]/g, '\\$&');
        const comodin =
          filtro.operador === 'endsWith' ? `%${literal}` : filtro.operador === 'startsWith' ? `${literal}%` : `%${literal}%`;
        whereFiltros.push(`LOWER(${campo.sql}) LIKE LOWER($${agregarValor(comodin)}) ESCAPE '\\'`);
      }
    }

    if (fuente.campoFechas) {
      if (request.dateFrom) whereFechas.push(clausula(fuente.campoFechas, '>=', validarFechaIso(request.dateFrom, 'dateFrom')));
      if (request.dateTo) whereFechas.push(clausula(fuente.campoFechas, '<=', validarFechaIso(request.dateTo, 'dateTo')));
    }

    // El rango de fechas siempre es AND; el combinador (AND por defecto, OR si se pide) solo afecta
    // a los filtros propiamente dichos, agrupados entre paréntesis para no alterar la precedencia.
    const combinador = request.matchType === 'OR' ? ' OR ' : ' AND ';
    const grupoFiltros =
      whereFiltros.length > 1 && request.matchType === 'OR' ? `(${whereFiltros.join(combinador)})` : whereFiltros.join(combinador);
    // La empresa va siempre y al final: no altera la numeracion de los filtros del usuario ni se puede quitar con un OR.
    const whereEmpresa = clausula(fuente.columnaEmpresa, '=', this.tenant.empresaId());
    const where = [...whereFechas, ...(grupoFiltros ? [grupoFiltros] : []), whereEmpresa];

    let orden: { campo: CampoReporte; direccion: 'asc' | 'desc' } | null = null;
    if (request.sort) {
      const campo = campoDe(fuente, request.sort.campo);
      if (agregar && campo.categoria !== 'MEASURE' && !claves.some((c) => c.name === campo.name)) {
        throw new BadRequestException(
          `No se puede ordenar por "${campo.label}": con métricas seleccionadas, el orden debe ser por una métrica o por una columna incluida en el reporte`,
        );
      }
      for (const join of campo.joins) joinsRequeridos.add(join);
      orden = { campo, direccion: request.sort.direccion };
    } else if (campos[0]) {
      orden = { campo: campos[0], direccion: 'asc' };
    }

    // Con el detalle unido, cada nota aparece una vez por linea: sus medidas de cabecera se reparten por peso.
    // Los filtros no: "monto total >= 100" sigue hablando del total de la nota.
    const peso = fuente.prorrateo && joinsRequeridos.has(fuente.prorrateo.join) ? fuente.prorrateo.peso : null;
    const valorDe = (campo: CampoReporte): string => (peso && campo.deCabecera ? `(${campo.sql} * ${peso})` : campo.sql);
    const ordenes = orden ? [this.expresionOrden(valorDe(orden.campo), orden.campo, agregar, orden.direccion)] : [];

    const joinsSql = Object.entries(fuente.joins)
      .filter(([id]) => joinsRequeridos.has(id))
      .map(([, sql]) => ` ${sql}`)
      .join('\n');
    const fromSql = `${fuente.tablaBase}${joinsSql}`;
    const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';

    const groupExprs = claves.map((campo) => campo.sql);
    const groupClause = agregar && groupExprs.length > 0 ? ` GROUP BY ${groupExprs.join(', ')}` : '';

    const limites = {
      limit: Math.min(Math.max(Math.floor(request.limit ?? LIMITE_POR_DEFECTO), 1), LIMITE_REPORTE_MAXIMO),
      offset: Math.max(Math.floor(request.offset ?? 0), 0),
    };

    const selects = campos.map((campo) => `${this.expresionSelect(valorDe(campo), campo, agregar, peso !== null)} AS "${campo.name}"`);
    let sql = `SELECT ${selects.join(', ')} FROM ${fromSql}${whereSql}${groupClause}`;
    if (ordenes.length) sql += ` ORDER BY ${ordenes.join(', ')}`;

    return { campos, fromSql, whereSql, groupExprs, agregar, params, sql, limites };
  }

  private async contar(
    fromSql: string,
    whereSql: string,
    groupExprs: string[],
    agregar: boolean,
    params: unknown[],
  ): Promise<number> {
    if (agregar && groupExprs.length === 0) return 1;
    const sql = agregar
      ? `SELECT COUNT(*)::int AS total FROM (SELECT ${groupExprs.join(', ')} FROM ${fromSql}${whereSql} GROUP BY ${groupExprs.join(', ')}) AS agrupado`
      : `SELECT COUNT(*)::int AS total FROM ${fromSql}${whereSql}`;
    const [fila] = await this.dataSource.query<Array<{ total: number }>>(sql, params);
    return fila?.total ?? 0;
  }

  /** `expr` es la expresion del campo ya prorrateada si corresponde; el dinero y lo repartido se redondean a centavos. */
  private expresionSelect(expr: string, campo: CampoReporte, agregar: boolean, prorrateado: boolean): string {
    const redondear = campo.moneda === true || (prorrateado && campo.deCabecera === true);
    if (agregar && campo.categoria === 'MEASURE') return redondear ? `ROUND(SUM(${expr}), 2)::float8` : `SUM(${expr})::float8`;
    if (campo.tipo === 'NUMBER') return redondear ? `ROUND(${expr}, 2)::float8` : `(${expr})::float8`;
    return expr;
  }

  private expresionOrden(expr: string, campo: CampoReporte, agregar: boolean, direccion: 'asc' | 'desc'): string {
    const valor = agregar && campo.categoria === 'MEASURE' ? `SUM(${expr})` : expr;
    // En Postgres DESC pone los NULL primero: "mayor margen" no debe empezar por los productos sin costo.
    return `${valor} ${direccion === 'desc' ? 'DESC NULLS LAST' : 'ASC'}`;
  }

  private coercionDeValor(campo: CampoReporte, valor: string | number | boolean): string | number | boolean {
    if (campo.tipo === 'BOOLEAN') {
      if (typeof valor !== 'boolean') {
        throw new BadRequestException(`El campo "${campo.label}" espera un valor verdadero/falso`);
      }
      return valor;
    }
    if (campo.tipo === 'NUMBER') {
      // Un <input type="number"> entrega texto ("100"): se acepta un numero escrito como texto, con punto o coma
      // decimal ("99.5" o "99,5"), y se rechaza todo lo demas ("", "abc", "1e9").
      const numero = typeof valor === 'string' && NUMERO_EN_TEXTO.test(valor.trim()) ? Number(valor.trim().replace(',', '.')) : valor;
      if (typeof numero !== 'number' || !Number.isFinite(numero)) {
        throw new BadRequestException(`El campo "${campo.label}" espera un valor numérico`);
      }
      return numero;
    }
    if (campo.tipo === 'DATE') {
      if (typeof valor !== 'string') {
        throw new BadRequestException(`El campo "${campo.label}" espera una fecha AAAA-MM-DD`);
      }
      return validarFechaIso(valor, campo.label);
    }
    return String(valor);
  }

  private serializar(valor: unknown): string | number | boolean {
    if (valor === null || valor === undefined) return '';
    if (valor instanceof Date) return fechaDeColumna(valor);
    if (typeof valor === 'number' || typeof valor === 'boolean' || typeof valor === 'string') return valor;
    return String(valor);
  }
}