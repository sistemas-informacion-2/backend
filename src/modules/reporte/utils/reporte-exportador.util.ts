import { FORMATOS_EXPORTACION, type FormatoExportacion, type ReportResultDto } from '../dto/reporte-builder.dto.js';

export interface ArchivoReporte {
  buffer: Buffer;
  contentType: string;
  nombreArchivo: string;
}

const CONTENT_TYPES: Record<FormatoExportacion, string> = {
  pdf: 'application/pdf',
  excel: 'application/vnd.ms-excel',
  html: 'text/html; charset=utf-8',
};

const EXTENSIONES: Record<FormatoExportacion, string> = {
  pdf: 'pdf',
  excel: 'xls',
  html: 'html',
};

/** Exporta el resultado del Report Builder sin dependencias externas. */
export function exportarReporte(formato: FormatoExportacion, nombreReporte: string, resultado: ReportResultDto): ArchivoReporte {
  if (!FORMATOS_EXPORTACION.includes(formato)) {
    throw new Error(`Formato de exportación no soportado: ${String(formato)}`);
  }
  const base = slugificar(nombreReporte);
  const contenido =
    formato === 'html'
      ? generarHtml(nombreReporte, resultado)
      : formato === 'excel'
        ? generarExcel(nombreReporte, resultado)
        : generarPdf(nombreReporte, resultado.columnLabels, resultado.rows);

  return {
    buffer: contenido,
    contentType: CONTENT_TYPES[formato],
    nombreArchivo: `${base}.${EXTENSIONES[formato]}`,
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
  <p>${resultado.total} filas en total · Generado ${new Date().toISOString().slice(0, 10)}</p>
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
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Encabezado"><Font ss:Bold="1"/></Style>
  </Styles>
  <Worksheet ss:Name="${escaparXml(slugificar(nombreReporte))}">
    <Table>
      <Row>${resultado.columnLabels.map((label) => `<Cell ss:StyleID="Encabezado"><Data ss:Type="String">${escaparXml(label)}</Data></Cell>`).join('')}</Row>
${filas}
    </Table>
  </Worksheet>
</Workbook>
`;
  return Buffer.from(xml, 'utf8');
}

/**
 * PDF A4 sin dependencias: título, encabezados en negrita y filas en texto.
 * Solo representable en Latin-1 (los caracteres fuera de ese rango se omiten).
 */
function generarPdf(titulo: string, encabezados: string[], filas: Array<Array<string | number | boolean>>): Buffer {
  const ANCHO_PAGINA = 595.28;
  const ALTO_PAGINA = 841.89;
  const MARGEN = 36;
  const ALTO_FILA = 12;
  const cantidadColumnas = encabezados.length;
  const anchoColumna = cantidadColumnas > 0 ? Math.max(38, (ANCHO_PAGINA - 2 * MARGEN) / cantidadColumnas) : 0;

  const paginas: string[][] = [];
  let actual: string[] = [];
  let y = ALTO_PAGINA - MARGEN;

  const dibujarCelda = (texto: string, fuente: 'F1' | 'F2', tam: number, x: number) => {
    actual.push(`BT /${fuente} ${tam} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escaparPdf(texto)}) Tj ET`);
  };
  const nuevaPagina = () => {
    paginas.push(actual);
    actual = [];
    y = ALTO_PAGINA - MARGEN;
  };

  dibujarCelda(recortar(titulo, 110), 'F2', 14, MARGEN);
  y -= 22;
  for (let i = 0; i < cantidadColumnas; i++) {
    dibujarCelda(recortar(encabezados[i], caracteresQueCaben(anchoColumna, 9)), 'F2', 9, MARGEN + i * anchoColumna);
  }
  y -= 17;

  for (const fila of filas) {
    if (y < MARGEN) nuevaPagina();
    for (let i = 0; i < cantidadColumnas; i++) {
      dibujarCelda(
        recortar(celdaTexto(fila[i]), caracteresQueCaben(anchoColumna, 8)),
        'F1',
        8,
        MARGEN + i * anchoColumna,
      );
    }
    y -= ALTO_FILA;
  }
  paginas.push(actual);

  const objetos: Array<string | undefined> = [];
  objetos[1] = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  objetos[2] = `2 0 obj\n<< /Type /Pages /Kids [${paginas.map((_, indice) => `${5 + indice * 2} 0 R`).join(' ')}] /Count ${paginas.length} >>\nendobj\n`;
  objetos[3] = '3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n';
  objetos[4] = '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n';

  const contenidoPorPagina: string[] = [];
  paginas.forEach((lineas, indice) => {
    const numPagina = 5 + indice * 2;
    const numContenido = 6 + indice * 2;
    const contenido = `${lineas.join('\n')}\n`;
    contenidoPorPagina[indice] = contenido;
    objetos[numPagina] =
      `${numPagina} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ANCHO_PAGINA} ${ALTO_PAGINA}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${numContenido} 0 R >>\nendobj\n`;
    objetos[numContenido] =
      `${numContenido} 0 obj\n<< /Length ${Buffer.byteLength(contenido, 'latin1')} >>\nstream\n${contenido}endstream\nendobj\n`;
  });

  const maximoObjeto = 5 + paginas.length * 2 - 1;
  const finObjetos = maximoObjeto + 1;

  const piezas: Buffer[] = [Buffer.from('%PDF-1.4\n', 'latin1')];
  const offsets: number[] = [];
  let posicion = piezas[0].length;
  for (let i = 1; i < finObjetos; i++) {
    offsets[i] = posicion;
    const cuerpo = Buffer.from(objetos[i] ?? '', 'latin1');
    piezas.push(cuerpo);
    posicion += cuerpo.length;
  }

  let tablaXref = `xref\n0 ${finObjetos}\n0000000000 65535 f \n`;
  for (let i = 1; i < finObjetos; i++) {
    tablaXref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  const cierre = `trailer\n<< /Size ${finObjetos} /Root 1 0 R >>\nstartxref\n${posicion}\n%%EOF\n`;

  return Buffer.concat([...piezas, Buffer.from(tablaXref, 'latin1'), Buffer.from(cierre, 'latin1')]);
}

function recortar(texto: string, maxCaracteres: number): string {
  if (texto.length <= maxCaracteres) return texto;
  return `${texto.slice(0, Math.max(maxCaracteres - 3, 0))}...`;
}

function caracteresQueCaben(ancho: number, tam: number): number {
  return Math.max(4, Math.floor(ancho / (tam * 0.52)));
}

function celdaTexto(valor: string | number | boolean): string {
  return valor === '' ? ' ' : String(valor);
}

function escaparPdf(texto: string): string {
  return texto
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .split('')
    .filter((caracter) => caracter.charCodeAt(0) <= 255)
    .join('');
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