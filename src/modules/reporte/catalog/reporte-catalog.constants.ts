import { BadRequestException } from '@nestjs/common';

/**
 * Catálogo de reportes dinámicos (CU18). Es la fuente de verdad para el
 * Report Builder: los nombres de campos, el tipo de campo, la categoría
 * (PLAIN/DIMENSION/MEASURE) y la expresión SQL segura que respalda cada
 * campo. El cliente NUNCA envía SQL: solo envía nombres de campos, y el
 * service resuelve la expresión desde este mapa (whitelist).
 *
 * Categorías:
 *  - PLAIN: valor informativo que se muestra tal cual (id, flags...).
 *  - DIMENSION: nivel de agregación (agrupa cuando hay medidas).
 *  - MEASURE: número agregable; al seleccionarse, la consulta agrupa por las
 *    dimensiones elegidas y resume con SUM(...).
 */
export type CategoriaCampo = 'PLAIN' | 'DIMENSION' | 'MEASURE';
export type TipoCampo = 'STRING' | 'NUMBER' | 'DATE' | 'BOOLEAN';
export type OperadorFiltro =
  | 'eq'
  | 'ne'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte';

export const OPERADORES_POR_TIPO: Record<TipoCampo, readonly OperadorFiltro[]> = {
  STRING: ['eq', 'ne', 'contains', 'startsWith', 'endsWith'],
  NUMBER: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'],
  DATE: ['eq', 'gt', 'gte', 'lt', 'lte'],
  BOOLEAN: ['eq'],
};

export const OPERADOR_SQL: Record<Exclude<OperadorFiltro, 'contains' | 'startsWith' | 'endsWith'>, string> = {
  eq: '=',
  ne: '<>',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
};

export interface CampoReporte {
  name: string;
  label: string;
  categoria: CategoriaCampo;
  tipo: TipoCampo;
  /** Expresión SQL transpilada desde el catálogo; nunca proviene del cliente. */
  sql: string;
  /** Conjuntos de JOIN requeridos para poder usar este campo. */
  joins: string[];
}

export interface FuenteReporte {
  id: string;
  nombre: string;
  descripcion: string;
  tablaBase: string;
  /** JOIN con nombre de conjunto; se incluye solo si algún campo/filtro lo pide. */
  joins: Record<string, string>;
  /** Conjuntos de JOIN que siempre se necesitan (la clave primaria del SELECT). */
  joinsSiempre: string[];
  /** Columna DATE del rango desde/hasta; null = el reporte no filtra por fechas. */
  campoFechas: string | null;
  campos: CampoReporte[];
}

const VENTAS: FuenteReporte = {
  id: 'VENTAS',
  nombre: 'Ventas',
  descripcion:
    'Notas de venta con detalle por producto, categoría, cliente y sucursal. Las medidas de cabecera (monto total, descuento e impuesto) se calculan por nota de venta.',
  tablaBase: 'nota_venta nv',
  campoFechas: 'nv.fecha_emision',
  joins: {
    SUCURSAL: 'LEFT JOIN sucursal sc ON sc.id = nv.id_sucursal',
    CLIENTE: 'LEFT JOIN usuario clu ON clu.id = nv.id_cliente',
    DETALLE: 'LEFT JOIN detalle_nota_venta dnv ON dnv.id_nota_venta = nv.id',
    VARIANTE: 'LEFT JOIN variante_producto vp ON vp.id = dnv.id_variante_producto',
    PRODUCTO: 'LEFT JOIN producto pr ON pr.id = vp.id_producto',
    CATEGORIA: 'LEFT JOIN categoria ct ON ct.id = pr.id_categoria',
  },
  joinsSiempre: [],
  campos: [
    { name: 'id_nota', label: 'ID nota', categoria: 'PLAIN', tipo: 'NUMBER', sql: 'nv.id::int', joins: [] },
    { name: 'codigo_nota', label: 'Código', categoria: 'DIMENSION', tipo: 'STRING', sql: 'nv.codigo_nota', joins: [] },
    { name: 'fecha_emision', label: 'Fecha', categoria: 'DIMENSION', tipo: 'DATE', sql: 'nv.fecha_emision', joins: [] },
    { name: 'sucursal', label: 'Sucursal', categoria: 'DIMENSION', tipo: 'STRING', sql: 'sc.nombre', joins: ['SUCURSAL'] },
    {
      name: 'cliente',
      label: 'Cliente',
      categoria: 'DIMENSION',
      tipo: 'STRING',
      sql: "TRIM(COALESCE(clu.nombre, '') || ' ' || COALESCE(clu.apellido, ''))",
      joins: ['CLIENTE'],
    },
    { name: 'categoria', label: 'Categoría', categoria: 'DIMENSION', tipo: 'STRING', sql: 'ct.nombre', joins: ['DETALLE', 'VARIANTE', 'PRODUCTO', 'CATEGORIA'] },
    { name: 'producto', label: 'Producto', categoria: 'DIMENSION', tipo: 'STRING', sql: 'pr.nombre', joins: ['DETALLE', 'VARIANTE', 'PRODUCTO'] },
    { name: 'variante', label: 'Variante (SKU)', categoria: 'DIMENSION', tipo: 'STRING', sql: 'vp.sku', joins: ['DETALLE', 'VARIANTE'] },
    { name: 'talla', label: 'Talla', categoria: 'DIMENSION', tipo: 'STRING', sql: 'vp.talla', joins: ['DETALLE', 'VARIANTE'] },
    { name: 'color', label: 'Color', categoria: 'DIMENSION', tipo: 'STRING', sql: 'vp.color', joins: ['DETALLE', 'VARIANTE'] },
    { name: 'tipo_venta', label: 'Tipo de venta', categoria: 'DIMENSION', tipo: 'STRING', sql: 'nv.tipo_venta', joins: [] },
    { name: 'estado_pago', label: 'Estado de pago', categoria: 'DIMENSION', tipo: 'STRING', sql: 'nv.estado_pago', joins: [] },
    { name: 'cantidad', label: 'Cantidad', categoria: 'MEASURE', tipo: 'NUMBER', sql: 'dnv.cantidad', joins: ['DETALLE'] },
    { name: 'subtotal', label: 'Subtotal', categoria: 'MEASURE', tipo: 'NUMBER', sql: 'dnv.subtotal', joins: ['DETALLE'] },
    { name: 'descuento', label: 'Descuento', categoria: 'MEASURE', tipo: 'NUMBER', sql: 'nv.descuento', joins: [] },
    { name: 'impuesto', label: 'Impuesto', categoria: 'MEASURE', tipo: 'NUMBER', sql: 'nv.impuesto', joins: [] },
    { name: 'monto_total', label: 'Monto total', categoria: 'MEASURE', tipo: 'NUMBER', sql: 'nv.monto_total', joins: [] },
  ],
};

const INVENTARIO: FuenteReporte = {
  id: 'INVENTARIO',
  nombre: 'Inventario y Stock',
  descripcion:
    'Existencias actuales por sucursal, almacén y variante, con alertas de stock crítico. No admite rango de fechas porque es una foto del momento.',
  tablaBase: 'inventario inv',
  campoFechas: null,
  joins: {
    ALMACEN: 'JOIN almacen alm ON alm.id = inv.id_almacen',
    SUCURSAL: 'JOIN sucursal sc ON sc.id = alm.id_sucursal',
    VARIANTE: 'JOIN variante_producto vp ON vp.id = inv.id_variante_producto',
    PRODUCTO: 'JOIN producto pr ON pr.id = vp.id_producto',
    CATEGORIA: 'JOIN categoria ct ON ct.id = pr.id_categoria',
  },
  joinsSiempre: ['ALMACEN', 'SUCURSAL'],
  campos: [
    { name: 'id_inventario', label: 'ID inventario', categoria: 'PLAIN', tipo: 'NUMBER', sql: 'inv.id::int', joins: [] },
    { name: 'sucursal', label: 'Sucursal', categoria: 'DIMENSION', tipo: 'STRING', sql: 'sc.nombre', joins: [] },
    { name: 'almacen', label: 'Almacén', categoria: 'DIMENSION', tipo: 'STRING', sql: 'alm.nombre', joins: [] },
    { name: 'categoria', label: 'Categoría', categoria: 'DIMENSION', tipo: 'STRING', sql: 'ct.nombre', joins: ['VARIANTE', 'PRODUCTO', 'CATEGORIA'] },
    { name: 'producto', label: 'Producto', categoria: 'DIMENSION', tipo: 'STRING', sql: 'pr.nombre', joins: ['VARIANTE', 'PRODUCTO'] },
    { name: 'variante', label: 'Variante (SKU)', categoria: 'DIMENSION', tipo: 'STRING', sql: 'vp.sku', joins: ['VARIANTE'] },
    { name: 'talla', label: 'Talla', categoria: 'DIMENSION', tipo: 'STRING', sql: 'vp.talla', joins: ['VARIANTE'] },
    { name: 'color', label: 'Color', categoria: 'DIMENSION', tipo: 'STRING', sql: 'vp.color', joins: ['VARIANTE'] },
    { name: 'precio', label: 'Precio', categoria: 'PLAIN', tipo: 'NUMBER', sql: 'pr.precio', joins: ['VARIANTE', 'PRODUCTO'] },
    { name: 'stock_disponible', label: 'Stock disponible', categoria: 'PLAIN', tipo: 'NUMBER', sql: 'inv.stock_disponible', joins: [] },
    { name: 'stock_reservado', label: 'Stock reservado', categoria: 'PLAIN', tipo: 'NUMBER', sql: 'inv.stock_reservado', joins: [] },
    { name: 'stock_minimo', label: 'Stock mínimo', categoria: 'PLAIN', tipo: 'NUMBER', sql: 'inv.stock_minimo', joins: [] },
    { name: 'stock_maximo', label: 'Stock máximo', categoria: 'PLAIN', tipo: 'NUMBER', sql: 'inv.stock_maximo', joins: [] },
    { name: 'en_stock_critico', label: '¿Stock crítico?', categoria: 'PLAIN', tipo: 'BOOLEAN', sql: '(inv.stock_disponible <= inv.stock_minimo)', joins: [] },
    { name: 'valor_inventario', label: 'Valor de inventario', categoria: 'PLAIN', tipo: 'NUMBER', sql: '(inv.stock_disponible * pr.precio)', joins: ['VARIANTE', 'PRODUCTO'] },
  ],
};

const COMPRAS: FuenteReporte = {
  id: 'COMPRAS',
  nombre: 'Compras',
  descripcion: 'Órdenes de compra a proveedores por sucursal y estado. Las medidas de cabecera se calculan por nota de compra.',
  tablaBase: 'nota_compra nc',
  campoFechas: 'nc.fecha_emision',
  joins: {
    SUCURSAL: 'LEFT JOIN sucursal sc ON sc.id = nc.id_sucursal',
    PROVEEDOR: 'LEFT JOIN proveedor pv ON pv.id = nc.id_proveedor',
    DETALLE: 'LEFT JOIN detalle_nota_compra dnc ON dnc.id_nota_compra = nc.id',
  },
  joinsSiempre: [],
  campos: [
    { name: 'id_compra', label: 'ID compra', categoria: 'PLAIN', tipo: 'NUMBER', sql: 'nc.id::int', joins: [] },
    { name: 'nro_factura', label: 'Nº factura', categoria: 'DIMENSION', tipo: 'STRING', sql: 'nc.nro_factura', joins: [] },
    { name: 'fecha_emision', label: 'Fecha', categoria: 'DIMENSION', tipo: 'DATE', sql: 'nc.fecha_emision', joins: [] },
    { name: 'sucursal', label: 'Sucursal', categoria: 'DIMENSION', tipo: 'STRING', sql: 'sc.nombre', joins: ['SUCURSAL'] },
    { name: 'proveedor', label: 'Proveedor', categoria: 'DIMENSION', tipo: 'STRING', sql: 'pv.empresa', joins: ['PROVEEDOR'] },
    { name: 'estado', label: 'Estado', categoria: 'DIMENSION', tipo: 'STRING', sql: 'nc.estado', joins: [] },
    { name: 'subtotal', label: 'Subtotal', categoria: 'MEASURE', tipo: 'NUMBER', sql: 'nc.subtotal', joins: [] },
    { name: 'total', label: 'Total', categoria: 'MEASURE', tipo: 'NUMBER', sql: 'nc.total', joins: [] },
    { name: 'cantidad', label: 'Cantidad', categoria: 'MEASURE', tipo: 'NUMBER', sql: 'dnc.cantidad', joins: ['DETALLE'] },
  ],
};

export const FUENTES_REPORTE: readonly FuenteReporte[] = [VENTAS, INVENTARIO, COMPRAS];

export function buscarFuente(tipoReporte: string): FuenteReporte {
  const fuente = FUENTES_REPORTE.find((candidata) => candidata.id === tipoReporte);
  if (!fuente) {
    throw new BadRequestException(`Tipo de reporte no soportado: ${tipoReporte}`);
  }
  return fuente;
}

export function campoDe(fuente: FuenteReporte, nombreCampo: string): CampoReporte {
  const campo = fuente.campos.find((candidato) => candidato.name === nombreCampo);
  if (!campo) {
    throw new BadRequestException(`El campo "${nombreCampo}" no existe en el reporte "${fuente.nombre}"`);
  }
  return campo;
}

export function esTipoNumerico(tipo: TipoCampo): boolean {
  return tipo === 'NUMBER';
}

/** Reduce una cadena a minúsculas sin acentos para comparar lenguaje natural. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function validarFechaIso(fecha: string, nombreCampo: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new BadRequestException(`El campo de fecha "${nombreCampo}" debe estar en formato AAAA-MM-DD`);
  }
  const instant = Date.parse(`${fecha}T00:00:00Z`);
  if (Number.isNaN(instant)) {
    throw new BadRequestException(`El campo de fecha "${nombreCampo}" no es una fecha válida`);
  }
  return fecha;
}