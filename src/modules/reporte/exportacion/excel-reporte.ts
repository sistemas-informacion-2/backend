import ExcelJS from 'exceljs';
import { fechaLocal, horaLocal } from '../../../common/utils/fecha.util.js';
import type { FormatoColumna } from '../dto/reporte-builder.dto.js';
import { fechaCorta } from './formato.js';
import type { DocumentoReporte } from './pdf-reporte.js';
import type { Grafico, Indicador } from './resumen.types.js';

/**
 * Excel profesional de un reporte (R5c de PLAN-REPORTES.md): un .xlsx real con ExcelJS, sin el aviso de "el formato
 * no coincide con la extension" del SpreadsheetML anterior. Dos hojas:
 *   - Resumen: encabezado, (generativo) el pedido, indicadores, una tabla por grafico, analisis y notas;
 *   - Datos: la tabla del reporte con formato Bs., fechas reales, encabezado fijo y filtros por columna.
 * Sin graficos (decision del plan): los graficos van en el PDF.
 */

const PLATAFORMA = 'DOMINATR';
/** Formatos de numero de Excel. El codigo usa la notacion de Excel; cada equipo lo muestra con su separador local. */
const FORMATO_BS = '"Bs "#,##0.00';
const FORMATO_NUMERO = '#,##0.##';
const FORMATO_ENTERO = '#,##0';
const FORMATO_PORCENTAJE = '0.0%';
const FORMATO_FECHA = 'dd/mm/yyyy';

// Misma paleta que el PDF (ARGB).
const TINTA = 'FF09090B';
const SUAVE = 'FF71717A';
const BORDE = 'FFE4E4E7';
const FILA_ALTERNA = 'FFFAFAFA';
const BLANCO = 'FFFFFFFF';

/** Columnas de la hoja Resumen: A (etiquetas) es ancha y las demas, para valores y porcentajes. */
const ANCHOS_RESUMEN = [42, 22, 16, 30];

export async function generarExcelReporte(documento: DocumentoReporte): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = PLATAFORMA;
  libro.lastModifiedBy = PLATAFORMA;
  libro.company = documento.tienda.nombre;
  libro.title = `${documento.resumen.titulo} · ${documento.tienda.nombre}`;
  libro.subject = documento.nombreReporte;
  libro.created = documento.generadoEn;
  libro.modified = documento.generadoEn;

  const acento = argb(documento.tienda.color) ?? TINTA;
  hojaResumen(libro, documento, acento);
  hojaDatos(libro, documento);

  return Buffer.from(await libro.xlsx.writeBuffer());
}

// ---------------------------------------------------------------- hoja Resumen

function hojaResumen(libro: ExcelJS.Workbook, documento: DocumentoReporte, acento: string): void {
  const { resumen, tienda, subtitulo, contexto, generadoEn } = documento;
  const hoja = libro.addWorksheet('Resumen', {
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    headerFooter: { oddFooter: `&L${PLATAFORMA} · Documento confidencial: uso interno de ${tienda.nombre}&RPágina &P de &N` },
  });
  hoja.columns = ANCHOS_RESUMEN.map((width) => ({ width }));
  const fila = new Escritor(hoja);

  fila.texto(PLATAFORMA, { negrita: true, color: TINTA, tam: 10 });
  fila.texto(resumen.titulo, { negrita: true, color: acento, tam: 9 });
  fila.texto(tienda.nombre, { negrita: true, color: TINTA, tam: 18 }, 26);
  if (subtitulo) fila.texto(subtitulo, { color: SUAVE, tam: 11 });
  fila.vacia();

  if (resumen.periodo) fila.par('Período', textoPeriodo(resumen.periodo));
  fila.par('Sucursal', resumen.sucursal ?? 'Todas');
  fila.par('Generado', `${fechaCorta(fechaLocal(generadoEn))} a las ${horaLocal(generadoEn).slice(0, 5)}`);
  fila.vacia();

  if (contexto) {
    fila.titulo('Tu pedido');
    fila.parrafo(`“${contexto.prompt}”`, { negrita: true });
    fila.titulo('Lo que entendió DOMINATR');
    fila.parrafo(contexto.interpretacion);
    fila.vacia();
  }

  if (resumen.indicadores.length > 0) {
    fila.titulo('Indicadores principales');
    fila.encabezado(['Indicador', 'Valor', '', 'Detalle']);
    for (const indicador of resumen.indicadores) fila.indicador(indicador);
    fila.vacia();
  }

  for (const grafico of resumen.graficos) {
    fila.titulo(grafico.titulo);
    fila.grafico(grafico);
    fila.vacia();
  }

  if (resumen.analisis.length > 0) {
    fila.titulo('Análisis comercial');
    for (const frase of resumen.analisis) fila.parrafo(`•  ${frase}`);
    fila.vacia();
  }
  if (resumen.oportunidades.length > 0) {
    fila.titulo('Oportunidades de análisis');
    for (const frase of resumen.oportunidades) fila.parrafo(`•  ${frase}`);
    fila.vacia();
  }
  for (const nota of resumen.notas) fila.parrafo(nota, { color: SUAVE, tam: 9 });
}

/** Escribe la hoja Resumen de arriba hacia abajo, una fila por llamada. */
class Escritor {
  constructor(private readonly hoja: ExcelJS.Worksheet) {}

  private siguiente(): ExcelJS.Row {
    return this.hoja.getRow(this.hoja.rowCount + 1);
  }

  vacia(): void {
    this.siguiente().getCell(1).value = '';
  }

  texto(valor: string, fuente: Fuente, alto?: number): void {
    const fila = this.siguiente();
    fila.getCell(1).value = valor;
    fila.getCell(1).font = fuenteExcel(fuente);
    if (alto) fila.height = alto;
  }

  par(etiqueta: string, valor: string): void {
    const fila = this.siguiente();
    fila.getCell(1).value = etiqueta;
    fila.getCell(1).font = fuenteExcel({ color: SUAVE, tam: 10 });
    fila.getCell(2).value = valor;
    fila.getCell(2).font = fuenteExcel({ color: TINTA, tam: 10 });
  }

  titulo(valor: string): void {
    const fila = this.siguiente();
    fila.getCell(1).value = valor;
    fila.getCell(1).font = fuenteExcel({ negrita: true, color: TINTA, tam: 12 });
    fila.height = 20;
  }

  /** Texto largo en las 4 columnas, con ajuste de linea. */
  parrafo(valor: string, fuente: Fuente = {}): void {
    const fila = this.siguiente();
    this.hoja.mergeCells(fila.number, 1, fila.number, ANCHOS_RESUMEN.length);
    const celda = fila.getCell(1);
    celda.value = valor;
    celda.font = fuenteExcel({ color: TINTA, tam: 10, ...fuente });
    celda.alignment = { wrapText: true, vertical: 'top' };
    // Excel no ajusta solo el alto de una celda combinada: se estima por el largo del texto.
    const ancho = ANCHOS_RESUMEN.reduce((a, b) => a + b, 0);
    fila.height = Math.max(16, Math.ceil(valor.length / (ancho * 1.05)) * 15);
  }

  encabezado(titulos: string[]): void {
    const fila = this.siguiente();
    titulos.forEach((titulo, i) => {
      const celda = fila.getCell(i + 1);
      celda.value = titulo;
      celda.font = fuenteExcel({ negrita: true, color: BLANCO, tam: 9 });
      celda.fill = relleno(TINTA);
      celda.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'right' };
    });
    fila.height = 18;
  }

  indicador(indicador: Indicador): void {
    const fila = this.siguiente();
    fila.getCell(1).value = indicador.etiqueta;
    const valor = fila.getCell(2);
    valor.value = indicador.valor ?? '—';
    if (typeof indicador.valor === 'number') valor.numFmt = indicador.formato === 'MONEDA' ? FORMATO_BS : FORMATO_NUMERO;
    valor.font = fuenteExcel({ negrita: true, color: TINTA, tam: 11 });
    valor.alignment = { horizontal: 'right' };
    fila.getCell(4).value = indicador.detalle ?? '';
    fila.getCell(4).font = fuenteExcel({ color: SUAVE, tam: 9 });
    bordeInferior(fila, ANCHOS_RESUMEN.length);
  }

  /** Los datos de un grafico como tabla: nombre, valor y participacion sobre el total. */
  grafico(grafico: Grafico): void {
    const total = grafico.puntos.reduce((suma, punto) => suma + punto.valor, 0);
    const conRanking = grafico.tipo === 'RANKING';
    this.encabezado([conRanking ? 'Posición y nombre' : 'Nombre', grafico.formato === 'MONEDA' ? 'Monto' : 'Cantidad', 'Participación']);
    grafico.puntos.forEach((punto, i) => {
      const fila = this.siguiente();
      fila.getCell(1).value = conRanking ? `${i + 1}. ${punto.etiqueta}` : punto.etiqueta;
      const valor = fila.getCell(2);
      valor.value = punto.valor;
      valor.numFmt = grafico.formato === 'MONEDA' ? FORMATO_BS : FORMATO_NUMERO;
      const parte = fila.getCell(3);
      parte.value = total > 0 ? punto.valor / total : 0;
      parte.numFmt = FORMATO_PORCENTAJE;
      parte.font = fuenteExcel({ color: SUAVE, tam: 10 });
      if (i % 2 === 1) for (let c = 1; c <= 3; c++) fila.getCell(c).fill = relleno(FILA_ALTERNA);
      bordeInferior(fila, 3);
    });
  }
}

// ---------------------------------------------------------------- hoja Datos

function hojaDatos(libro: ExcelJS.Workbook, documento: DocumentoReporte): void {
  const { resultado, tienda } = documento;
  const hoja = libro.addWorksheet('Datos', {
    // El encabezado (y la columna #) quedan fijos al desplazar.
    views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }],
    pageSetup: { paperSize: 9, orientation: resultado.columns.length >= 8 ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    headerFooter: { oddFooter: `&L${PLATAFORMA} · Documento confidencial: uso interno de ${tienda.nombre}&RPágina &P de &N` },
  });
  const formatos: FormatoColumna[] = resultado.columns.map((_, i) => resultado.columnFormats?.[i] ?? 'TEXTO');
  const titulos = ['#', ...resultado.columnLabels];

  const encabezado = hoja.getRow(1);
  titulos.forEach((titulo, i) => {
    const celda = encabezado.getCell(i + 1);
    celda.value = titulo;
    celda.font = fuenteExcel({ negrita: true, color: BLANCO, tam: 10 });
    celda.fill = relleno(TINTA);
    const numerica = i === 0 || formatos[i - 1] === 'NUMERO' || formatos[i - 1] === 'MONEDA';
    celda.alignment = { vertical: 'middle', horizontal: numerica ? 'right' : 'left', wrapText: true };
  });
  encabezado.height = 22;

  resultado.rows.forEach((valores, f) => {
    const fila = hoja.getRow(f + 2);
    fila.getCell(1).value = f + 1;
    fila.getCell(1).font = fuenteExcel({ color: SUAVE, tam: 10 });
    valores.forEach((valor, c) => escribirCelda(fila.getCell(c + 2), valor, formatos[c]));
    if (f % 2 === 1) for (let c = 1; c <= titulos.length; c++) fila.getCell(c).fill = relleno(FILA_ALTERNA);
  });

  // Filtros en el encabezado, sobre todas las filas de datos.
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(resultado.rows.length + 1, 1), column: titulos.length } };

  // Ancho segun el contenido (encabezado y primeras 300 filas), entre 6 y 50 caracteres.
  hoja.columns.forEach((columna, i) => {
    let largo = titulos[i].length;
    for (const fila of resultado.rows.slice(0, 300)) {
      const valor = i === 0 ? '' : fila[i - 1];
      const texto = typeof valor === 'number' ? (formatos[i - 1] === 'MONEDA' ? `Bs ${valor.toFixed(2)}` : String(valor)) : String(valor ?? '');
      largo = Math.max(largo, texto.length);
    }
    columna.width = Math.min(Math.max(largo + 3, 6), 50);
  });

  if (resultado.rows.length < resultado.total) {
    const aviso = hoja.getRow(resultado.rows.length + 3).getCell(2);
    aviso.value = `Se muestran las primeras ${resultado.rows.length} de ${resultado.total} filas. La hoja Resumen usa todas.`;
    aviso.font = fuenteExcel({ color: SUAVE, tam: 9, cursiva: true });
  }
}

/** Valor con su tipo real de Excel: numero, fecha o texto (verdadero/falso como "Sí"/"No"). */
function escribirCelda(celda: ExcelJS.Cell, valor: string | number | boolean, formato: FormatoColumna): void {
  celda.font = fuenteExcel({ color: TINTA, tam: 10 });
  if (valor === '' || valor === null || valor === undefined) {
    celda.value = null;
    return;
  }
  if (typeof valor === 'boolean') {
    celda.value = valor ? 'Sí' : 'No';
    return;
  }
  if (typeof valor === 'number') {
    celda.value = valor;
    celda.numFmt = formato === 'MONEDA' ? FORMATO_BS : Number.isInteger(valor) ? FORMATO_ENTERO : FORMATO_NUMERO;
    return;
  }
  if (formato === 'FECHA' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [anio, mes, dia] = valor.split('-').map(Number);
    celda.value = new Date(Date.UTC(anio, mes - 1, dia));
    celda.numFmt = FORMATO_FECHA;
    celda.alignment = { horizontal: 'left' };
    return;
  }
  celda.value = valor;
}

// ---------------------------------------------------------------- utilidades

interface Fuente {
  negrita?: boolean;
  cursiva?: boolean;
  color?: string;
  tam?: number;
}

function fuenteExcel({ negrita = false, cursiva = false, color = TINTA, tam = 10 }: Fuente): Partial<ExcelJS.Font> {
  return { name: 'Calibri', size: tam, bold: negrita, italic: cursiva, color: { argb: color } };
}

function relleno(color: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
}

function bordeInferior(fila: ExcelJS.Row, columnas: number): void {
  for (let c = 1; c <= columnas; c++) fila.getCell(c).border = { bottom: { style: 'thin', color: { argb: BORDE } } };
}

/** "#4f46e5" → "FF4F46E5"; null si no es un color valido. */
function argb(color: string | null): string | null {
  return color && /^#[0-9a-fA-F]{6}$/.test(color) ? `FF${color.slice(1).toUpperCase()}` : null;
}

function textoPeriodo(periodo: { desde?: string; hasta?: string }): string {
  if (periodo.desde && periodo.hasta) return `${fechaCorta(periodo.desde)} – ${fechaCorta(periodo.hasta)}`;
  if (periodo.desde) return `Desde el ${fechaCorta(periodo.desde)}`;
  if (periodo.hasta) return `Hasta el ${fechaCorta(periodo.hasta)}`;
  return 'Todo el historial';
}
