/**
 * Resumen de un reporte para el PDF y el Excel profesionales (R5 de PLAN-REPORTES.md): indicadores, graficos y
 * analisis. Se calcula sobre TODOS los datos del reporte (mismos filtros, fechas y empresa), no sobre las filas de la
 * tabla, que pueden venir recortadas a 500.
 */
export type TipoResumen = 'VENTAS' | 'INVENTARIO' | 'COMPRAS';

/** Como se muestra un valor: "Bs 1.234,56", "1.234" o texto. */
export type FormatoValor = 'MONEDA' | 'NUMERO' | 'TEXTO';

export interface Indicador {
  etiqueta: string;
  /** null cuando no hay datos (por ejemplo, el producto mas vendido de un periodo sin ventas). */
  valor: number | string | null;
  formato: FormatoValor;
  /** Dato que acompana al valor: "117 unidades", "Bs 23.400,00". */
  detalle?: string;
}

export interface PuntoSerie {
  etiqueta: string;
  valor: number;
}

export type TipoGrafico = 'BARRAS' | 'ANILLO' | 'RANKING' | 'LINEA';

export interface Grafico {
  id: string;
  titulo: string;
  tipo: TipoGrafico;
  formato: Exclude<FormatoValor, 'TEXTO'>;
  puntos: PuntoSerie[];
}

export interface ResumenReporte {
  tipo: TipoResumen;
  /** "REPORTE DE VENTAS", "REPORTE DE INVENTARIO" o "REPORTE DE COMPRAS". */
  titulo: string;
  /** Rango pedido (AAAA-MM-DD); sin fechas es todo el historial. Inventario no tiene periodo. */
  periodo: { desde?: string; hasta?: string } | null;
  /** Sucursal si el reporte filtra por una sola; null si abarca todas. */
  sucursal: string | null;
  indicadores: Indicador[];
  graficos: Grafico[];
  /** Frases del analisis comercial, armadas con reglas fijas a partir de los numeros (ver analisis.ts). */
  analisis: string[];
  /** Sugerencias de que mirar despues. */
  oportunidades: string[];
  /** Aclaraciones honestas sobre los datos ("no incluye costos", "sin valor a costo para variantes sin compras"). */
  notas: string[];
}
