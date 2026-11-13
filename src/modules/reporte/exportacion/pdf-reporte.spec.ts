import { generarPdfReporte, type DocumentoReporte } from './pdf-reporte.js';
import type { ReportResultDto } from '../dto/reporte-builder.dto.js';
import type { ResumenReporte } from './resumen.types.js';

const resumen: ResumenReporte = {
  tipo: 'VENTAS',
  titulo: 'REPORTE DE VENTAS',
  periodo: { desde: '2026-08-01', hasta: '2026-10-31' },
  sucursal: 'Centro',
  indicadores: [
    { etiqueta: 'Ingresos totales', valor: 608280.5, formato: 'MONEDA', detalle: '1.863 notas de venta' },
    { etiqueta: 'Unidades vendidas', valor: 3422, formato: 'NUMERO' },
    { etiqueta: 'Productos diferentes', valor: 22, formato: 'NUMERO' },
    { etiqueta: 'Producto más vendido', valor: 'Polera básica de algodón', formato: 'TEXTO', detalle: '746 unidades' },
    { etiqueta: 'Producto con más ingresos', valor: null, formato: 'TEXTO' },
  ],
  graficos: [
    { id: 'b', titulo: 'Ingresos por producto', tipo: 'BARRAS', formato: 'MONEDA', puntos: [{ etiqueta: 'Jean', valor: 500 }, { etiqueta: 'Polera', valor: 0 }] },
    { id: 'a', titulo: 'Participación', tipo: 'ANILLO', formato: 'MONEDA', puntos: [{ etiqueta: 'Jean', valor: 500 }, { etiqueta: 'Otros', valor: 250 }] },
    { id: 'a1', titulo: 'Una sola porción', tipo: 'ANILLO', formato: 'MONEDA', puntos: [{ etiqueta: 'Jean', valor: 500 }] },
    { id: 'r', titulo: 'Ranking', tipo: 'RANKING', formato: 'NUMERO', puntos: [{ etiqueta: 'Polera', valor: 746 }] },
    { id: 'l', titulo: 'Por mes', tipo: 'LINEA', formato: 'MONEDA', puntos: [{ etiqueta: 'ago. 2026', valor: 1 }, { etiqueta: 'sep. 2026', valor: 2 }] },
  ],
  analisis: ['Los 3 productos con más ingresos generan el 28,2 % del total (Bs 171.593,08).'],
  oportunidades: ['Revisa el stock de Polera.'],
  notas: ['Los montos son ventas con impuestos, no ganancias.'],
};

function resultado(filas: number, columnas = 2): ReportResultDto {
  const nombres = Array.from({ length: columnas }, (_, i) => `col${i}`);
  return {
    columns: nombres,
    columnLabels: nombres.map((n, i) => (i === 0 ? 'Producto' : `Columna número ${i}`)),
    columnFormats: nombres.map((_, i) => (i === 0 ? 'TEXTO' : 'MONEDA')),
    rows: Array.from({ length: filas }, (_, f) => nombres.map((_, i) => (i === 0 ? `Producto 😀 ${f}` : f * 10.5))),
    total: filas,
  };
}

function documento(datos: Partial<DocumentoReporte> = {}): DocumentoReporte {
  return {
    nombreReporte: 'Ventas',
    resultado: resultado(5),
    resumen,
    tienda: { nombre: 'Moda Andina', logo: null, color: '#4f46e5' },
    generadoEn: new Date('2026-11-13T14:30:00Z'),
    ...datos,
  };
}

/** Páginas del PDF: cada una es un objeto "/Type /Page" (no "/Pages"). */
function paginas(pdf: Buffer): number {
  return (pdf.toString('latin1').match(/\/Type \/Page[^s]/g) ?? []).length;
}

describe('generarPdfReporte', () => {
  it('arma un PDF válido con todas sus secciones, sin romperse con valores vacíos ni emojis', async () => {
    const pdf = await generarPdfReporte(documento({ contexto: { prompt: 'ventas de poleras del mes pasado', interpretacion: 'Ventas de poleras de octubre.' } }));

    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pdf.toString('latin1')).toContain('%%EOF');
    // Resumen y análisis (1 o 2 páginas) y el detalle, que siempre empieza en una página nueva.
    expect(paginas(pdf)).toBeGreaterThanOrEqual(2);
  });

  it('una tabla larga sigue en varias páginas', async () => {
    const corta = paginas(await generarPdfReporte(documento({ resultado: resultado(10) })));
    const larga = paginas(await generarPdfReporte(documento({ resultado: resultado(500) })));

    // Unas 40 filas por página vertical: 500 filas son 12 páginas más.
    expect(larga - corta).toBeGreaterThanOrEqual(11);
  });

  it('con 8 columnas o más el detalle va en horizontal', async () => {
    const pdf = (await generarPdfReporte(documento({ resultado: resultado(3, 9) }))).toString('latin1');

    // A4 horizontal: el ancho (841,89) va primero en el MediaBox.
    expect(pdf).toMatch(/\/MediaBox \[0 0 841\.89\d* 595\.28/);
  });

  it('un reporte sin filas y sin gráficos también se genera', async () => {
    const vacio: ResumenReporte = { ...resumen, indicadores: [], graficos: [], analisis: [], oportunidades: [], notas: [] };
    const pdf = await generarPdfReporte(documento({ resumen: vacio, resultado: { ...resultado(0), total: 0 }, tienda: { nombre: '', logo: null, color: 'no-es-un-color' } }));

    expect(paginas(pdf)).toBeGreaterThanOrEqual(2);
  });

  it('un logo que no es una imagen no rompe el PDF (se usan las iniciales)', async () => {
    const pdf = await generarPdfReporte(documento({ tienda: { nombre: 'Moda Andina', logo: Buffer.from('no es un png'), color: null } }));

    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });
});
