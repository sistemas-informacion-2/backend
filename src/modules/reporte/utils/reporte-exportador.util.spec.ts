import 'reflect-metadata';
import { exportarReporte, necesitaResumen, type DocumentoExportacion } from './reporte-exportador.util.js';
import type { ReportResultDto } from '../dto/reporte-builder.dto.js';
import type { ResumenReporte } from '../exportacion/resumen.types.js';

const resultado: ReportResultDto = {
  columns: ['sucursal', 'monto_total'],
  columnLabels: ['Sucursal', 'Monto total'],
  columnFormats: ['TEXTO', 'MONEDA'],
  rows: [
    ['La Paz', 300],
    ['Santa Cruz', 450.5],
  ],
  total: 2,
};

const resumen: ResumenReporte = {
  tipo: 'VENTAS',
  titulo: 'REPORTE DE VENTAS',
  periodo: { desde: '2026-10-01', hasta: '2026-10-31' },
  sucursal: null,
  indicadores: [{ etiqueta: 'Ingresos totales', valor: 750.5, formato: 'MONEDA' }],
  graficos: [],
  analisis: ['La Paz tiene el 40,0 % de los ingresos.'],
  oportunidades: [],
  notas: [],
};

function documento(datos: Partial<DocumentoExportacion> = {}): DocumentoExportacion {
  return { nombreReporte: 'Ventas', resultado, resumen, tienda: { nombre: 'Moda Andina', logo: null, color: null }, ...datos };
}

describe('exportarReporte', () => {
  it('genera un HTML con la tabla', async () => {
    const archivo = await exportarReporte('html', documento());

    expect(archivo.contentType).toContain('text/html');
    expect(archivo.buffer.toString('utf8')).toContain('<table');
    expect(archivo.buffer.toString('utf8')).toContain('Monto total');
  });

  it('genera un Excel .xlsx real (un ZIP), no el SpreadsheetML de antes', async () => {
    const archivo = await exportarReporte('excel', documento());

    expect(archivo.contentType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(archivo.nombreArchivo).toBe('ventas.xlsx');
    expect(archivo.buffer.subarray(0, 2).toString('latin1')).toBe('PK');
  });

  it('genera el PDF profesional', async () => {
    const archivo = await exportarReporte('pdf', documento());

    expect(archivo.contentType).toBe('application/pdf');
    expect(archivo.nombreArchivo).toBe('ventas.pdf');
    expect(archivo.buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('el PDF sin resumen o sin tienda falla con un mensaje claro', async () => {
    await expect(exportarReporte('pdf', documento({ resumen: undefined }))).rejects.toThrow(/resumen/);
  });

  it('el PDF y el Excel necesitan el resumen; el HTML no', () => {
    expect(necesitaResumen('pdf')).toBe(true);
    expect(necesitaResumen('excel')).toBe(true);
    expect(necesitaResumen('html')).toBe(false);
  });

  describe('cuando el reporte tiene más filas que las exportadas', () => {
    const recortado: ReportResultDto = { ...resultado, total: 1234 };

    // El aviso del Excel se prueba en excel-reporte.spec.ts: el .xlsx está comprimido.
    it('el html lo avisa', async () => {
      const texto = (await exportarReporte('html', documento({ resultado: recortado }))).buffer.toString('utf8');
      expect(texto).toContain('Se muestran las primeras 2 de 1.234 filas');
    });

    it('sin recorte no muestra el aviso', async () => {
      const texto = (await exportarReporte('html', documento())).buffer.toString('utf8');
      expect(texto).toContain('2 filas');
      expect(texto).not.toContain('Se muestran');
    });
  });

  it('sanea el nombre de archivo según el formato', async () => {
    expect((await exportarReporte('excel', documento({ nombreReporte: 'Ventas 2026' }))).nombreArchivo).toBe('ventas-2026.xlsx');
  });
});
