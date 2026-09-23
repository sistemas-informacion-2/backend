import 'reflect-metadata';
import { exportarReporte } from './reporte-exportador.util.js';
import type { ReportResultDto } from '../dto/reporte-builder.dto.js';

const resultado: ReportResultDto = {
  columns: ['sucursal', 'monto_total'],
  columnLabels: ['Sucursal', 'Monto total'],
  rows: [
    ['La Paz', 300],
    ['Santa Cruz', 450.5],
  ],
  total: 2,
};

describe('exportarReporte', () => {
  it('genera un HTML con la tabla', () => {
    const archivo = exportarReporte('html', 'Ventas', resultado);

    expect(archivo.contentType).toContain('text/html');
    expect(archivo.buffer.toString('utf8')).toContain('<table');
    expect(archivo.buffer.toString('utf8')).toContain('Monto total');
  });

  it('genera un Excel (SpreadsheetML)', () => {
    const archivo = exportarReporte('excel', 'Ventas', resultado);

    expect(archivo.contentType).toContain('application/vnd.ms-excel');
    expect(archivo.nombreArchivo).toBe('ventas.xls');
    expect(archivo.buffer.toString('utf8')).toContain('<Workbook');
  });

  it('genera un PDF estructuralmente válido', () => {
    const archivo = exportarReporte('pdf', 'Ventas', resultado);

    expect(archivo.contentType).toBe('application/pdf');
    const texto = archivo.buffer.toString('latin1');
    expect(texto.startsWith('%PDF-1.4')).toBe(true);
    expect(texto).toContain('startxref');
    expect(texto).toContain('%%EOF');
  });

  it('sanea el nombre de archivo según el formato', () => {
    expect(exportarReporte('excel', 'Ventas 2026', resultado).nombreArchivo).toBe('ventas-2026.xls');
  });
});