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

  it('genera un Excel (SpreadsheetML)', async () => {
    const archivo = await exportarReporte('excel', documento());

    expect(archivo.contentType).toContain('application/vnd.ms-excel');
    expect(archivo.nombreArchivo).toBe('ventas.xls');
    expect(archivo.buffer.toString('utf8')).toContain('<Workbook');
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

  it('solo el PDF necesita calcular el resumen', () => {
    expect(necesitaResumen('pdf')).toBe(true);
    expect(necesitaResumen('html')).toBe(false);
  });

  describe('cuando el reporte tiene más filas que las exportadas', () => {
    const recortado: ReportResultDto = { ...resultado, total: 1234 };

    it.each([
      ['html', 'utf8'],
      ['excel', 'utf8'],
    ] as const)('el %s lo avisa', async (formato, codificacion) => {
      const texto = (await exportarReporte(formato, documento({ resultado: recortado }))).buffer.toString(codificacion);
      expect(texto).toContain('Se muestran las primeras 2 de 1.234 filas');
    });

    it('sin recorte no muestra el aviso', async () => {
      const texto = (await exportarReporte('html', documento())).buffer.toString('utf8');
      expect(texto).toContain('2 filas');
      expect(texto).not.toContain('Se muestran');
    });
  });

  it('sanea el nombre de archivo según el formato', async () => {
    expect((await exportarReporte('excel', documento({ nombreReporte: 'Ventas 2026' }))).nombreArchivo).toBe('ventas-2026.xls');
  });
});
