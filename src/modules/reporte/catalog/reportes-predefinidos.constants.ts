import type { ReportFilterDto } from '../dto/reporte-builder.dto.js';

/**
 * Cómo se resuelve el rango de fechas de un predefinido al ejecutarlo: no se
 * guarda "2026-10-01" fijo en el catálogo (quedaría viejo al día siguiente),
 * se guarda la REGLA y `ReportsService` la convierte a fechas concretas en
 * el momento de ejecutar. INVENTARIO no admite fechas (es una foto del stock
 * actual), por eso ahí siempre es 'NINGUNO'.
 */
export type RangoPredefinido = { tipo: 'NINGUNO' } | { tipo: 'HOY' } | { tipo: 'ULTIMOS_N_DIAS'; dias: number } | { tipo: 'MES_ACTUAL' };

export interface ReportePredefinido {
  codigo: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  reportType: 'VENTAS' | 'INVENTARIO' | 'COMPRAS';
  selectedFields: string[];
  filters?: ReportFilterDto[];
  sort?: { campo: string; direccion: 'asc' | 'desc' };
  limit?: number;
  rango: RangoPredefinido;
}

/**
 * Catálogo de reportes predefinidos (CU18): consultas ya armadas para las
 * necesidades de información más comunes del negocio (ventas del día,
 * prendas más vendidas, stock crítico, compras del mes...). Se ejecutan con
 * un clic, sin que el usuario tenga que configurar nada en el Constructor QBE.
 *
 * Reutiliza exactamente los mismos campos/tipos de reporte del catálogo del
 * Report Builder (`reporte-catalog.constants.ts`): un predefinido no es más
 * que un `ReportRunRequestDto` guardado de antemano, así que nunca puede
 * pedir un campo que no exista — lo valida igual `ReportBuilderService`.
 */
export const REPORTES_PREDEFINIDOS: readonly ReportePredefinido[] = [
  {
    codigo: 'VENTAS_HOY',
    nombre: 'Ventas de hoy',
    descripcion: 'Notas de venta emitidas hoy, con su sucursal, producto y monto.',
    categoria: 'Ventas',
    reportType: 'VENTAS',
    selectedFields: ['fecha_emision', 'sucursal', 'producto', 'cantidad', 'monto_total'],
    sort: { campo: 'fecha_emision', direccion: 'desc' },
    rango: { tipo: 'HOY' },
  },
  {
    codigo: 'VENTAS_TOP_PRODUCTOS',
    nombre: 'Prendas más vendidas (30 días)',
    descripcion: 'Las 10 prendas con más unidades vendidas en el último mes, con su categoría.',
    categoria: 'Ventas',
    reportType: 'VENTAS',
    selectedFields: ['producto', 'categoria', 'cantidad', 'monto_total'],
    sort: { campo: 'cantidad', direccion: 'desc' },
    limit: 10,
    rango: { tipo: 'ULTIMOS_N_DIAS', dias: 30 },
  },
  {
    codigo: 'VENTAS_POR_SUCURSAL',
    nombre: 'Ventas por sucursal (7 días)',
    descripcion: 'Comparativo de ingresos y unidades vendidas entre sucursales en la última semana.',
    categoria: 'Ventas',
    reportType: 'VENTAS',
    selectedFields: ['sucursal', 'cantidad', 'monto_total'],
    sort: { campo: 'monto_total', direccion: 'desc' },
    rango: { tipo: 'ULTIMOS_N_DIAS', dias: 7 },
  },
  {
    codigo: 'STOCK_CRITICO',
    nombre: 'Stock crítico',
    descripcion: 'Variantes cuyo stock disponible ya llegó al mínimo configurado para esa prenda.',
    categoria: 'Inventario',
    reportType: 'INVENTARIO',
    selectedFields: ['sucursal', 'almacen', 'producto', 'talla', 'color', 'stock_disponible', 'stock_minimo'],
    filters: [{ campo: 'en_stock_critico', operador: 'eq', valor: true }],
    sort: { campo: 'stock_disponible', direccion: 'asc' },
    rango: { tipo: 'NINGUNO' },
  },
  {
    codigo: 'COMPRAS_MES',
    nombre: 'Compras del mes',
    descripcion: 'Órdenes de compra a proveedores emitidas desde el primero del mes actual.',
    categoria: 'Compras',
    reportType: 'COMPRAS',
    selectedFields: ['fecha_emision', 'proveedor', 'sucursal', 'total'],
    sort: { campo: 'fecha_emision', direccion: 'desc' },
    rango: { tipo: 'MES_ACTUAL' },
  },
];

export function buscarReportePredefinido(codigo: string): ReportePredefinido | undefined {
  return REPORTES_PREDEFINIDOS.find((reporte) => reporte.codigo === codigo);
}
