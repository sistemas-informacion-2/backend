import ExcelJS from 'exceljs';
import { generarExcelReporte } from './excel-reporte.js';
import type { DocumentoReporte } from './pdf-reporte.js';
import type { ReportResultDto } from '../dto/reporte-builder.dto.js';
import type { ResumenReporte } from './resumen.types.js';

const resumen: ResumenReporte = {
  tipo: 'VENTAS',
  titulo: 'REPORTE DE VENTAS',
  periodo: { desde: '2026-10-01', hasta: '2026-10-31' },
  sucursal: null,
  indicadores: [
    { etiqueta: 'Ingresos totales', valor: 155578, formato: 'MONEDA', detalle: '612 notas de venta' },
    { etiqueta: 'Producto más vendido', valor: 'Polera básica de algodón', formato: 'TEXTO', detalle: '387 unidades' },
    { etiqueta: 'Producto con más ingresos', valor: null, formato: 'TEXTO' },
  ],
  graficos: [{ id: 'r', titulo: 'Productos más vendidos (unidades)', tipo: 'RANKING', formato: 'NUMERO', puntos: [{ etiqueta: 'Polera', valor: 300 }, { etiqueta: 'Jean', valor: 100 }] }],
  analisis: ['Los 3 productos con más ingresos generan el 43,6 % del total.'],
  oportunidades: ['Revisa el stock de Polera.'],
  notas: ['Los montos son ventas con impuestos, no ganancias.'],
};

const resultado: ReportResultDto = {
  columns: ['fecha_emision', 'producto', 'cantidad', 'monto_total', 'cliente_identificado'],
  columnLabels: ['Fecha', 'Producto', 'Cantidad', 'Monto total', '¿Cliente identificado?'],
  columnFormats: ['FECHA', 'TEXTO', 'NUMERO', 'MONEDA', 'BOOLEANO'],
  rows: [
    ['2026-10-05', 'Polera', 3, 240.5, true],
    ['2026-10-06', '', 1, 80, false],
  ],
  total: 2,
};

function documento(datos: Partial<DocumentoReporte> = {}): DocumentoReporte {
  return {
    nombreReporte: 'Ventas',
    resultado,
    resumen,
    tienda: { nombre: 'Moda Andina', logo: null, color: '#4f46e5' },
    generadoEn: new Date('2026-11-13T14:30:00Z'),
    ...datos,
  };
}

async function abrir(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer);
  return libro;
}

/** Todos los textos de la columna A de una hoja (para buscar secciones). */
function textosColumnaA(hoja: ExcelJS.Worksheet): string[] {
  const textos: string[] = [];
  hoja.eachRow((fila) => textos.push(String(fila.getCell(1).value ?? '')));
  return textos;
}

describe('generarExcelReporte', () => {
  it('es un .xlsx real con las hojas Resumen y Datos, y las propiedades del archivo', async () => {
    const buffer = await generarExcelReporte(documento());

    // Un .xlsx es un ZIP: empieza con "PK".
    expect(buffer.subarray(0, 2).toString('latin1')).toBe('PK');
    const libro = await abrir(buffer);
    expect(libro.worksheets.map((hoja) => hoja.name)).toEqual(['Resumen', 'Datos']);
    expect(libro.creator).toBe('DOMINATR');
    expect(libro.company).toBe('Moda Andina');
  });

  it('el Resumen trae encabezado, indicadores con formato Bs, la tabla del gráfico y el análisis', async () => {
    const hoja = (await abrir(await generarExcelReporte(documento()))).getWorksheet('Resumen')!;
    const textos = textosColumnaA(hoja);

    expect(textos.slice(0, 3)).toEqual(['DOMINATR', 'REPORTE DE VENTAS', 'Moda Andina']);
    expect(textos).toContain('Período');
    expect(textos).toContain('Indicadores principales');
    expect(textos).toContain('1. Polera');
    expect(textos).toContain('•  Los 3 productos con más ingresos generan el 43,6 % del total.');

    const filaIngresos = hoja.getRow(textos.indexOf('Ingresos totales') + 1);
    expect(filaIngresos.getCell(2).value).toBe(155578);
    expect(filaIngresos.getCell(2).numFmt).toBe('"Bs "#,##0.00');
    // Un indicador sin dato se muestra con una raya, no vacío.
    expect(hoja.getRow(textos.indexOf('Producto con más ingresos') + 1).getCell(2).value).toBe('—');
    // El ranking muestra solo los primeros: un porcentaje sobre ellos no sería el del total, así que no lleva.
    const filaRanking = hoja.getRow(textos.indexOf('1. Polera') + 1);
    expect(filaRanking.getCell(2).value).toBe(300);
    expect(filaRanking.getCell(2).numFmt).toBe('#,##0');
    expect(filaRanking.getCell(3).value).toBeNull();
  });

  it('el anillo sí lleva participación, porque con "Otros" suma el total', async () => {
    const conAnillo: ResumenReporte = {
      ...resumen,
      graficos: [{ id: 'a', titulo: 'Participación', tipo: 'ANILLO', formato: 'MONEDA', puntos: [{ etiqueta: 'Polera', valor: 300 }, { etiqueta: 'Otros', valor: 100 }] }],
    };
    const hoja = (await abrir(await generarExcelReporte(documento({ resumen: conAnillo })))).getWorksheet('Resumen')!;
    const textos = textosColumnaA(hoja);

    expect(hoja.getRow(textos.indexOf('Polera') + 1).getCell(3).value).toBe(0.75);
    expect(hoja.getRow(textos.indexOf('Otros') + 1).getCell(3).numFmt).toBe('0.0%');
  });

  it('los enteros no llevan decimales (en Excel "#,##0.##" deja un separador colgando)', async () => {
    const hoja = (await abrir(await generarExcelReporte(documento()))).getWorksheet('Datos')!;

    expect(hoja.getRow(2).getCell(4).numFmt).toBe('#,##0');
  });

  it('con el pedido del generativo, el Resumen lo muestra', async () => {
    const hoja = (await abrir(await generarExcelReporte(documento({ contexto: { prompt: 'ventas de octubre', interpretacion: 'Ventas de octubre de 2026.' } }))))
      .getWorksheet('Resumen')!;

    expect(textosColumnaA(hoja)).toEqual(expect.arrayContaining(['Tu pedido', '“ventas de octubre”', 'Lo que entendió DOMINATR', 'Ventas de octubre de 2026.']));
  });

  it('Datos tiene tipos reales: fecha, número, Bs y Sí/No; encabezado fijo y filtros', async () => {
    const hoja = (await abrir(await generarExcelReporte(documento()))).getWorksheet('Datos')!;

    expect(hoja.getRow(1).values).toEqual([undefined, '#', 'Fecha', 'Producto', 'Cantidad', 'Monto total', '¿Cliente identificado?']);
    const fila = hoja.getRow(2);
    expect(fila.getCell(1).value).toBe(1);
    expect(fila.getCell(2).value).toEqual(new Date(Date.UTC(2026, 9, 5)));
    expect(fila.getCell(2).numFmt).toBe('dd/mm/yyyy');
    expect(fila.getCell(4).value).toBe(3);
    expect(fila.getCell(5).value).toBe(240.5);
    expect(fila.getCell(5).numFmt).toBe('"Bs "#,##0.00');
    expect(fila.getCell(6).value).toBe('Sí');
    // Un valor vacío queda como celda vacía, no como texto.
    expect(hoja.getRow(3).getCell(3).value).toBeNull();
    expect(hoja.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(hoja.autoFilter).toBeTruthy();
  });

  it('si el reporte se recortó, Datos lo avisa al final', async () => {
    const hoja = (await abrir(await generarExcelReporte(documento({ resultado: { ...resultado, total: 900 } })))).getWorksheet('Datos')!;

    expect(String(hoja.getRow(5).getCell(2).value)).toContain('Se muestran las primeras 2 de 900 filas');
  });
});
