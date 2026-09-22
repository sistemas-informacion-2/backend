import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
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
  type ReportResultDto,
  type ReportRunRequestDto,
  type ReportTypeDefinitionDto,
} from '../dto/reporte-builder.dto.js';

const LIMITE_POR_DEFECTO = 25;
const OPERADORES_DIRECTOS: ReadonlySet<OperadorFiltro> = new Set(['eq', 'ne', 'gt', 'gte', 'lt', 'lte']);

/**
 * Ejecuta las consultas del Report Builder (CU18) usando el catálogo de
 * reportes como whitelist. Todo valor llega como parámetro ($n) y toda
 * columna sale de la metadata transpilada en `reporte-catalog.constants.ts`;
 * el cliente nunca aporta SQL.
 */
@Injectable()
export class ReportBuilderService {
  constructor(private readonly dataSource: DataSource) {}

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
        operadores: [...OPERADORES_POR_TIPO[campo.tipo]],
      })),
    }));
  }

  /** Nombre legible de un tipo de reporte (para nombres de archivo de exportación). */
  nombreTipo(tipoReporte: string): string {
    return buscarFuente(tipoReporte).nombre;
  }

  async ejecutar(request: ReportRunRequestDto): Promise<ReportResultDto> {
    const fuente = buscarFuente(request.reportType);

    const joinsRequeridos = new Set<string>(fuente.joinsSiempre);
    const campos = request.selectedFields.map((name) => {
      const campo = campoDe(fuente, name);
      for (const join of campo.joins) joinsRequeridos.add(join);
      return campo;
    });

    const agregar = campos.some((campo) => campo.categoria === 'MEASURE');
    const claves = campos.filter((campo) => campo.categoria !== 'MEASURE');

    const where: string[] = [];
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
        where.push(clausula(campo.sql, simbolo, valor));
      } else {
        const comodin =
          filtro.operador === 'endsWith' ? `%${valor}` : filtro.operador === 'startsWith' ? `${valor}%` : `%${valor}%`;
        where.push(`LOWER(${campo.sql}) LIKE LOWER($${agregarValor(comodin)})`);
      }
    }

    if (fuente.campoFechas) {
      if (request.dateFrom) where.push(clausula(fuente.campoFechas, '>=', validarFechaIso(request.dateFrom, 'dateFrom')));
      if (request.dateTo) where.push(clausula(fuente.campoFechas, '<=', validarFechaIso(request.dateTo, 'dateTo')));
    }

    let ordenes: string[] = [];
    if (request.sort) {
      const campo = campoDe(fuente, request.sort.campo);
      if (agregar && campo.categoria !== 'MEASURE' && !claves.some((c) => c.name === campo.name)) {
        throw new BadRequestException(
          `No se puede ordenar por "${campo.label}": con métricas seleccionadas, el orden debe ser por una métrica o por una columna incluida en el reporte`,
        );
      }
      for (const join of campo.joins) joinsRequeridos.add(join);
      ordenes.push(this.expresionOrden(campo, agregar, request.sort.direccion));
    } else if (campos[0]) {
      ordenes.push(`${this.expresionOrden(campos[0], agregar, 'asc')}`);
    }

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

    const total = await this.contar(fromSql, whereSql, groupExprs, agregar, params);

    const selects = campos.map((campo) => `${this.expresionSelect(campo, agregar)} AS "${campo.name}"`);
    let sql = `SELECT ${selects.join(', ')} FROM ${fromSql}${whereSql}${groupClause}`;
    if (ordenes.length) sql += ` ORDER BY ${ordenes.join(', ')}`;
    sql += ` LIMIT $${agregarValor(limites.limit)} OFFSET $${agregarValor(limites.offset)}`;

    const filas = await this.dataSource.query<Array<Record<string, unknown>>>(sql, params);

    return {
      columns: request.selectedFields,
      columnLabels: campos.map((campo) => campo.label),
      rows: filas.map((fila) => request.selectedFields.map((name) => this.serializar(fila[name]))),
      total,
    };
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

  private expresionSelect(campo: CampoReporte, agregar: boolean): string {
    if (agregar && campo.categoria === 'MEASURE') return `SUM(${campo.sql})::float8`;
    if (campo.tipo === 'NUMBER') return `(${campo.sql})::float8`;
    return campo.sql;
  }

  private expresionOrden(campo: CampoReporte, agregar: boolean, direccion: 'asc' | 'desc'): string {
    const expr = agregar && campo.categoria === 'MEASURE' ? `SUM(${campo.sql})` : campo.sql;
    return `${expr} ${direccion === 'desc' ? 'DESC' : 'ASC'}`;
  }

  private coercionDeValor(campo: CampoReporte, valor: string | number | boolean): string | number | boolean {
    if (campo.tipo === 'BOOLEAN') {
      if (typeof valor !== 'boolean') {
        throw new BadRequestException(`El campo "${campo.label}" espera un valor verdadero/falso`);
      }
      return valor;
    }
    if (campo.tipo === 'NUMBER') {
      if (typeof valor !== 'number' || Number.isNaN(valor)) {
        throw new BadRequestException(`El campo "${campo.label}" espera un valor numérico`);
      }
      return valor;
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
    if (valor instanceof Date) return valor.toISOString().slice(0, 10);
    if (typeof valor === 'number' || typeof valor === 'boolean' || typeof valor === 'string') return valor;
    return String(valor);
  }
}