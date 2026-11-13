import { FORMATOS_EXPORTACION, type FormatoExportacion, type ReportResultDto } from '../dto/reporte-builder.dto.js';
import { fechaLocal } from '../../../common/utils/fecha.util.js';
import { generarExcelReporte } from '../exportacion/excel-reporte.js';
import { generarPdfReporte, type TiendaReporte } from '../exportacion/pdf-reporte.js';
import type { ResumenReporte } from '../exportacion/resumen.types.js';

export interface ArchivoReporte {
  buffer: Buffer;
  contentType: string;
  nombreArchivo: string;
}

/** Lo que hace falta para exportar. El PDF y el Excel necesitan ademas el resumen y la tienda (el HTML no). */
export interface DocumentoExportacion {
  /** Nombre del reporte: el del predefinido ("Stock crítico") o el de la fuente ("Ventas"). */
  nombreReporte: string;
  /** Linea bajo el nombre de la tienda en el PDF (el nombre del predefinido). */
  subtitulo?: string;
  resultado: ReportResultDto;
  resumen?: ResumenReporte;
  tienda?: TiendaReporte;
  generadoEn?: Date;
  contexto?: { prompt: string; interpretacion: string };
}

/** Formatos que llevan indicadores, graficos y analisis: hay que calcular el resumen antes de exportar. */
export function necesitaResumen(formato: FormatoExportacion): boolean {
  return formato === 'pdf' || formato === 'excel';
}

const CONTENT_TYPES: Record<FormatoExportacion, string> = {
  pdf: 'application/pdf',
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  html: 'text/html; charset=utf-8',
};

const EXTENSIONES: Record<FormatoExportacion, string> = {
  pdf: 'pdf',
  excel: 'xlsx',
  html: 'html',
};

/** Exporta el resultado del Report Builder: PDF (exportacion/pdf-reporte.ts), Excel (exportacion/excel-reporte.ts) y HTML. */
export async function exportarReporte(formato: FormatoExportacion, documento: DocumentoExportacion): Promise<ArchivoReporte> {
  if (!FORMATOS_EXPORTACION.includes(formato)) {
    throw new Error(`Formato de exportación no soportado: ${String(formato)}`);
  }
  const { nombreReporte, resultado } = documento;
  let contenido: Buffer;
  if (necesitaResumen(formato)) {
    if (!documento.resumen || !documento.tienda) throw new Error(`El ${formato === 'pdf' ? 'PDF' : 'Excel'} necesita el resumen y los datos de la tienda`);
    const completo = {
      nombreReporte,
      subtitulo: documento.subtitulo,
      resultado,
      resumen: documento.resumen,
      tienda: documento.tienda,
      generadoEn: documento.generadoEn ?? new Date(),
      contexto: documento.contexto,
    };
    contenido = formato === 'pdf' ? await generarPdfReporte(completo) : await generarExcelReporte(completo);
  } else {
    contenido = generarHtml(nombreReporte, resultado);
  }

  return {
    buffer: contenido,
    contentType: CONTENT_TYPES[formato],
    nombreArchivo: `${slugificar(nombreReporte)}.${EXTENSIONES[formato]}`,
  };
}

function generarHtml(nombreReporte: string, resultado: ReportResultDto): Buffer {
  const filasHtml = resultado.rows
    .map(
      (fila) =>
        `<tr>${fila.map((celda) => `<td>${escaparHtml(celdaTexto(celda))}</td>`).join('')}</tr>`,
    )
    .join('\n');
  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${escaparHtml(nombreReporte)}</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 24px; color: #171717; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    p { font-size: 12px; color: #525252; margin: 0 0 16px; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; }
    th, td { border: 1px solid #d4d4d4; padding: 6px 10px; text-align: left; }
    th { background: #f5f5f5; font-weight: 600; }
    tr:nth-child(even) td { background: #fafafa; }
  </style>
</head>
<body>
  <h1>${escaparHtml(nombreReporte)}</h1>
  <p>${escaparHtml(resumenFilas(resultado))} · Generado ${fechaLocal()}</p>
  <table>
    <thead><tr>${resultado.columnLabels.map((label) => `<th>${escaparHtml(label)}</th>`).join('')}</tr></thead>
    <tbody>${filasHtml}</tbody>
  </table>
</body>
</html>
`;
  return Buffer.from(html, 'utf8');
}

function generarExcel(nombreReporte: string, resultado: ReportResultDto): Buffer {
  const celda = (valor: string | number | boolean): string => {
    if (typeof valor === 'number') return `<Cell><Data ss:Type="Number">${valor}</Data></Cell>`;
    if (typeof valor === 'boolean') return `<Cell><Data ss:Type="Boolean">${String(valor)}</Data></Cell>`;
    return `<Cell><Data ss:Type="String">${escaparXml(celdaTexto(valor))}</Data></Cell>`;
  };
  const filas = resultado.rows.map((fila) => `<Row>${fila.map(celda).join('')}</Row>`).join('\n');
  // Si el reporte se recorto, el aviso va al final: la primera fila sigue siendo el encabezado de la tabla.
  const aviso = estaRecortado(resultado) ? `\n<Row></Row>\n<Row>${celda(resumenFilas(resultado))}</Row>` : '';
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Encabezado"><Font ss:Bold="1"/></Style>
  </Styles>
  <Worksheet ss:Name="${escaparXml(slugificar(nombreReporte))}">
    <Table>
      <Row>${resultado.columnLabels.map((label) => `<Cell ss:StyleID="Encabezado"><Data ss:Type="String">${escaparXml(label)}</Data></Cell>`).join('')}</Row>
${filas}${aviso}
    </Table>
  </Worksheet>
</Workbook>
`;
  return Buffer.from(xml, 'utf8');
}

/** true si el archivo trae menos filas que el reporte (se exporta hasta LIMITE_REPORTE_MAXIMO). */
function estaRecortado(resultado: ReportResultDto): boolean {
  return resultado.rows.length < resultado.total;
}

/** "120 filas" o, si se recorto, "Se muestran las primeras 500 de 1.234 filas". */
function resumenFilas(resultado: ReportResultDto): string {
  const total = resultado.total.toLocaleString('es-BO');
  if (!estaRecortado(resultado)) return `${total} ${resultado.total === 1 ? 'fila' : 'filas'}`;
  return `Se muestran las primeras ${resultado.rows.length.toLocaleString('es-BO')} de ${total} filas`;
}

function celdaTexto(valor: string | number | boolean): string {
  return valor === '' ? ' ' : String(valor);
}

function escaparHtml(valor: string): string {
  return valor.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escaparXml(valor: string): string {
  return escaparHtml(valor).replace(/'/g, '&apos;');
}

function slugificar(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}