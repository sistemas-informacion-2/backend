import { Injectable } from '@nestjs/common';
import { fechaLocal } from '../../../common/utils/fecha.util.js';
import { LIMITE_REPORTE_MAXIMO, type ReportRunRequestDto } from '../dto/reporte-builder.dto.js';
import { ReportBuilderService } from '../services/report-builder.service.js';
import { analizarCompras, analizarInventario, analizarVentas, type Fila, type FilaMes, type FilaProducto } from './analisis.js';
import { formatearBs, formatearNumero, mesCorto } from './formato.js';
import type { Grafico, Indicador, PuntoSerie, ResumenReporte, TipoResumen } from './resumen.types.js';

/** Barras y rankings muestran como maximo estas filas; el anillo, las primeras 5 mas "Otros". */
const FILAS_GRAFICO = 10;
const PORCIONES_ANILLO = 5;

const TITULOS: Record<TipoResumen, string> = {
  VENTAS: 'REPORTE DE VENTAS',
  INVENTARIO: 'REPORTE DE INVENTARIO',
  COMPRAS: 'REPORTE DE COMPRAS',
};

/**
 * Indicadores, graficos y analisis de un reporte (R5 de PLAN-REPORTES.md).
 *
 * Todo sale del mismo ReportBuilderService, pidiendole variantes del reporte del usuario con sus mismos filtros,
 * fechas y empresa (solo cambian las columnas y el orden). Asi el resumen usa la misma whitelist, el mismo reparto de
 * los montos de cabecera y el mismo aislamiento por empresa que la tabla, y sus totales coinciden con ella. Se calcula
 * sobre todos los datos, no sobre las filas exportadas (que se recortan a 500).
 */
@Injectable()
export class ResumenReporteService {
  constructor(private readonly builder: ReportBuilderService) {}

  async resumir(request: ReportRunRequestDto): Promise<ResumenReporte> {
    const tipo = request.reportType as TipoResumen;
    // Del pedido del usuario se conservan solo los filtros y el rango; columnas, orden y paginas se arman aca.
    const base: ReportRunRequestDto = {
      reportType: request.reportType,
      selectedFields: [],
      filters: request.filters ?? [],
      matchType: request.matchType,
      dateFrom: request.dateFrom,
      dateTo: request.dateTo,
    };
    const parcial =
      tipo === 'VENTAS' ? await this.ventas(base) : tipo === 'INVENTARIO' ? await this.inventario(base) : await this.compras(base);

    return {
      tipo,
      titulo: TITULOS[tipo] ?? `REPORTE DE ${tipo}`,
      periodo: tipo === 'INVENTARIO' ? null : { desde: request.dateFrom, hasta: request.dateTo },
      sucursal: sucursalFiltrada(request),
      ...parcial,
    };
  }

  // ---------------------------------------------------------------- ventas

  private async ventas(base: ReportRunRequestDto): Promise<Omit<ResumenReporte, 'tipo' | 'titulo' | 'periodo' | 'sucursal'>> {
    const [totales, porIngresos, porUnidades, sucursales, meses] = await Promise.all([
      this.filas(base, ['monto_total', 'cantidad', 'notas']),
      this.filasConTotal(base, ['producto', 'monto_total', 'cantidad'], 'monto_total', LIMITE_REPORTE_MAXIMO),
      this.filas(base, ['producto', 'monto_total', 'cantidad'], 'cantidad', 1),
      this.filas(base, ['sucursal', 'monto_total'], 'monto_total'),
      this.filas(base, ['mes', 'monto_total'], 'mes', LIMITE_REPORTE_MAXIMO, 'asc'),
    ]);

    const ingresos = numero(totales[0]?.[0]);
    const unidades = numero(totales[0]?.[1]);
    const productos: FilaProducto[] = porIngresos.filas.map((fila) => ({ nombre: texto(fila[0]), ingresos: numero(fila[1]), unidades: numero(fila[2]) }));
    const masVendidoFila = porUnidades[0];
    const masVendido = masVendidoFila ? { nombre: texto(masVendidoFila[0]), ingresos: numero(masVendidoFila[1]), unidades: numero(masVendidoFila[2]) } : null;
    const filasSucursal = aFilas(sucursales);
    const filasMes: FilaMes[] = meses.map((fila) => ({ mes: texto(fila[0]), valor: numero(fila[1]) }));
    const topIngresos = productos[0];

    const indicadores: Indicador[] = [
      { etiqueta: 'Ingresos totales', valor: ingresos, formato: 'MONEDA', detalle: `${formatearNumero(numero(totales[0]?.[2]))} notas de venta` },
      { etiqueta: 'Unidades vendidas', valor: unidades, formato: 'NUMERO' },
      { etiqueta: 'Productos diferentes', valor: porIngresos.total, formato: 'NUMERO' },
      {
        etiqueta: 'Producto más vendido',
        valor: masVendido?.nombre ?? null,
        formato: 'TEXTO',
        detalle: masVendido ? `${formatearNumero(masVendido.unidades)} unidades` : undefined,
      },
      {
        etiqueta: 'Producto con más ingresos',
        valor: topIngresos?.nombre ?? null,
        formato: 'TEXTO',
        detalle: topIngresos ? formatearBs(topIngresos.ingresos) : undefined,
      },
    ];

    const graficos: Grafico[] = [];
    if (productos.length > 0) {
      graficos.push(
        grafico('ingresos-producto', 'Ingresos por producto', 'BARRAS', 'MONEDA', productos.map((p) => ({ etiqueta: p.nombre, valor: p.ingresos }))),
        anillo('participacion-producto', 'Participación en los ingresos', productos.map((p) => ({ etiqueta: p.nombre, valor: p.ingresos })), ingresos),
        grafico(
          'ranking-unidades',
          'Productos más vendidos (unidades)',
          'RANKING',
          'NUMERO',
          [...productos].sort((a, b) => b.unidades - a.unidades).map((p) => ({ etiqueta: p.nombre, valor: p.unidades })),
        ),
      );
    }
    if (filasSucursal.length >= 2) graficos.push(grafico('ingresos-sucursal', 'Ingresos por sucursal', 'BARRAS', 'MONEDA', aPuntos(filasSucursal)));
    if (filasMes.length >= 2) {
      graficos.push({ id: 'ingresos-mes', titulo: 'Ingresos por mes', tipo: 'LINEA', formato: 'MONEDA', puntos: filasMes.map((f) => ({ etiqueta: mesCorto(f.mes), valor: f.valor })) });
    }

    const analisis = analizarVentas({
      ingresos,
      unidades,
      productos,
      totalProductos: porIngresos.total,
      masVendido,
      sucursales: filasSucursal,
      meses: filasMes,
      mesEnCurso: fechaLocal().slice(0, 7),
    });
    return { indicadores, graficos, ...analisis };
  }

  // ---------------------------------------------------------------- inventario

  private async inventario(base: ReportRunRequestDto): Promise<Omit<ResumenReporte, 'tipo' | 'titulo' | 'periodo' | 'sucursal'>> {
    const [totales, sucursales, categorias, productos, criticasPorSucursal] = await Promise.all([
      this.filas(base, ['stock_disponible', 'variantes_criticas', 'valor_inventario']),
      this.filas(base, ['sucursal', 'stock_disponible'], 'stock_disponible'),
      this.filas(base, ['categoria', 'valor_inventario'], 'valor_inventario'),
      this.filas(base, ['producto', 'stock_disponible'], 'stock_disponible', FILAS_GRAFICO),
      this.filas(base, ['sucursal', 'variantes_criticas'], 'variantes_criticas'),
    ]);

    const unidades = numero(totales[0]?.[0]);
    const variantesCriticas = numero(totales[0]?.[1]);
    const valorCosto = numero(totales[0]?.[2]);
    const filasSucursal = aFilas(sucursales);
    const filasCategoria = aFilas(categorias);
    const filasProducto = aFilas(productos);
    const filasCriticas = aFilas(criticasPorSucursal).filter((fila) => fila.valor > 0);

    const indicadores: Indicador[] = [
      { etiqueta: 'Unidades en stock', valor: unidades, formato: 'NUMERO' },
      { etiqueta: 'Variantes en stock crítico', valor: variantesCriticas, formato: 'NUMERO', detalle: 'stock igual o menor al mínimo' },
      { etiqueta: 'Inventario a costo', valor: valorCosto, formato: 'MONEDA' },
      {
        etiqueta: 'Sucursal con más stock',
        valor: filasSucursal[0]?.nombre ?? null,
        formato: 'TEXTO',
        detalle: filasSucursal[0] ? `${formatearNumero(filasSucursal[0].valor)} unidades` : undefined,
      },
      {
        etiqueta: 'Producto con más stock',
        valor: filasProducto[0]?.nombre ?? null,
        formato: 'TEXTO',
        detalle: filasProducto[0] ? `${formatearNumero(filasProducto[0].valor)} unidades` : undefined,
      },
    ];

    const graficos: Grafico[] = [];
    if (filasSucursal.length > 0) graficos.push(grafico('stock-sucursal', 'Unidades en stock por sucursal', 'BARRAS', 'NUMERO', aPuntos(filasSucursal)));
    if (filasCategoria.length > 0) graficos.push(grafico('valor-categoria', 'Valor a costo por categoría', 'BARRAS', 'MONEDA', aPuntos(filasCategoria)));
    if (filasProducto.length > 0) graficos.push(grafico('ranking-stock', 'Productos con más unidades', 'RANKING', 'NUMERO', aPuntos(filasProducto)));
    if (filasCriticas.length > 0) graficos.push(grafico('criticas-sucursal', 'Variantes en stock crítico por sucursal', 'BARRAS', 'NUMERO', aPuntos(filasCriticas)));

    const analisis = analizarInventario({
      unidades,
      valorCosto,
      variantesCriticas,
      sucursales: filasSucursal,
      categorias: filasCategoria,
      productos: filasProducto,
    });
    return { indicadores, graficos, ...analisis };
  }

  // ---------------------------------------------------------------- compras

  private async compras(base: ReportRunRequestDto): Promise<Omit<ResumenReporte, 'tipo' | 'titulo' | 'periodo' | 'sucursal'>> {
    const [totales, proveedores, meses] = await Promise.all([
      this.filas(base, ['total', 'ordenes']),
      this.filasConTotal(base, ['proveedor', 'total'], 'total', LIMITE_REPORTE_MAXIMO),
      this.filas(base, ['mes', 'total'], 'mes', LIMITE_REPORTE_MAXIMO, 'asc'),
    ]);

    const total = numero(totales[0]?.[0]);
    const ordenes = numero(totales[0]?.[1]);
    const filasProveedor = aFilas(proveedores.filas);
    const filasMes: FilaMes[] = meses.map((fila) => ({ mes: texto(fila[0]), valor: numero(fila[1]) }));
    const principal = filasProveedor[0];

    const indicadores: Indicador[] = [
      { etiqueta: 'Total comprado', valor: total, formato: 'MONEDA' },
      { etiqueta: 'Órdenes de compra', valor: ordenes, formato: 'NUMERO' },
      { etiqueta: 'Proveedores', valor: proveedores.total, formato: 'NUMERO' },
      { etiqueta: 'Proveedor principal', valor: principal?.nombre ?? null, formato: 'TEXTO', detalle: principal ? formatearBs(principal.valor) : undefined },
      { etiqueta: 'Promedio por orden', valor: ordenes > 0 ? Math.round((total / ordenes) * 100) / 100 : null, formato: 'MONEDA' },
    ];

    const graficos: Grafico[] = [];
    if (filasProveedor.length > 0) {
      graficos.push(
        grafico('compras-proveedor', 'Total comprado por proveedor', 'BARRAS', 'MONEDA', aPuntos(filasProveedor)),
        anillo('participacion-proveedor', 'Participación de cada proveedor', aPuntos(filasProveedor), total),
      );
    }
    if (filasMes.length >= 2) {
      graficos.push({ id: 'compras-mes', titulo: 'Compras por mes', tipo: 'LINEA', formato: 'MONEDA', puntos: filasMes.map((f) => ({ etiqueta: mesCorto(f.mes), valor: f.valor })) });
    }

    const analisis = analizarCompras({
      total,
      ordenes,
      proveedores: filasProveedor,
      totalProveedores: proveedores.total,
      meses: filasMes,
      mesEnCurso: fechaLocal().slice(0, 7),
    });
    return { indicadores, graficos, ...analisis };
  }

  // ---------------------------------------------------------------- consultas

  private async filas(
    base: ReportRunRequestDto,
    campos: string[],
    ordenarPor?: string,
    limite = LIMITE_REPORTE_MAXIMO,
    direccion: 'asc' | 'desc' = 'desc',
  ): Promise<Array<Array<string | number | boolean>>> {
    return (await this.filasConTotal(base, campos, ordenarPor, limite, direccion)).filas;
  }

  /** `total` es la cantidad de grupos (por ejemplo, de productos distintos), aunque se traigan menos filas. */
  private async filasConTotal(
    base: ReportRunRequestDto,
    campos: string[],
    ordenarPor?: string,
    limite = LIMITE_REPORTE_MAXIMO,
    direccion: 'asc' | 'desc' = 'desc',
  ): Promise<{ filas: Array<Array<string | number | boolean>>; total: number }> {
    const resultado = await this.builder.ejecutar({
      ...base,
      selectedFields: campos,
      sort: ordenarPor ? { campo: ordenarPor, direccion } : undefined,
      limit: limite,
      offset: 0,
    });
    return { filas: resultado.rows, total: resultado.total };
  }
}

/** La sucursal del reporte si filtra por una sola ("sucursal igual a X", sin OR); si no, null. */
function sucursalFiltrada(request: ReportRunRequestDto): string | null {
  const filtros = request.filters ?? [];
  if (request.matchType === 'OR' && filtros.length > 1) return null;
  const filtro = filtros.find((f) => f.campo === 'sucursal' && f.operador === 'eq');
  return filtro ? String(filtro.valor) : null;
}

function grafico(id: string, titulo: string, tipo: Grafico['tipo'], formato: Grafico['formato'], puntos: PuntoSerie[]): Grafico {
  return { id, titulo, tipo, formato, puntos: puntos.slice(0, FILAS_GRAFICO) };
}

/** Las primeras porciones y, si sobra, "Otros" con el resto hasta el total. */
function anillo(id: string, titulo: string, puntos: PuntoSerie[], total: number): Grafico {
  const principales = puntos.slice(0, PORCIONES_ANILLO);
  const resto = Math.round((total - principales.reduce((suma, p) => suma + p.valor, 0)) * 100) / 100;
  return { id, titulo, tipo: 'ANILLO', formato: 'MONEDA', puntos: resto > 0.005 ? [...principales, { etiqueta: 'Otros', valor: resto }] : principales };
}

function aFilas(filas: Array<Array<string | number | boolean>>): Fila[] {
  return filas.map((fila) => ({ nombre: texto(fila[0]), valor: numero(fila[1]) }));
}

function aPuntos(filas: Fila[]): PuntoSerie[] {
  return filas.map((fila) => ({ etiqueta: fila.nombre, valor: fila.valor }));
}

/** Una suma sin filas llega como '' (NULL serializado): cuenta como 0. */
function numero(valor: unknown): number {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : 0;
}

/** Un grupo sin nombre (por ejemplo, una venta sin sucursal) se muestra como "Sin dato". */
function texto(valor: unknown): string {
  return valor === '' || valor === null || valor === undefined ? 'Sin dato' : String(valor);
}
