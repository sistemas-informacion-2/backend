import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { normalizarTexto } from '../catalog/reporte-catalog.constants.js';
import type { ReportFilterDto, ReportRunRequestDto } from '../dto/reporte-builder.dto.js';

export interface InterpretacionPrompt {
  request: ReportRunRequestDto;
  interpretacion: string;
}

const LIMITE_NLP_MAXIMO = 100;

const CAMPOS_POR_TIPO: Record<'VENTAS' | 'INVENTARIO' | 'COMPRAS', string[]> = {
  VENTAS: ['fecha_emision', 'sucursal', 'producto', 'categoria', 'monto_total', 'cantidad'],
  INVENTARIO: ['sucursal', 'almacen', 'producto', 'variante', 'stock_disponible', 'en_stock_critico'],
  COMPRAS: ['fecha_emision', 'sucursal', 'proveedor', 'total'],
};

const NOMBRE_POR_TIPO: Record<'VENTAS' | 'INVENTARIO' | 'COMPRAS', string> = {
  VENTAS: 'Ventas',
  INVENTARIO: 'Inventario y Stock',
  COMPRAS: 'Compras',
};

// El orden por defecto (cuando no se pidió "top N") depende del tipo: Inventario
// no tiene fecha_emision (no es un movimiento con fecha, es una foto del stock
// actual), así que ordenar "por defecto" con ese campo tiraba
// `El campo "fecha_emision" no existe en el reporte "Inventario y Stock"` para
// cualquier pedido de inventario que no fuera un top. Cada tipo ordena por un
// campo que sí tiene: fecha_emision para movimientos, stock ascendente para
// inventario (así lo más crítico queda primero).
const ORDEN_POR_DEFECTO: Record<'VENTAS' | 'INVENTARIO' | 'COMPRAS', { campo: string; direccion: 'asc' | 'desc' }> = {
  VENTAS: { campo: 'fecha_emision', direccion: 'desc' },
  COMPRAS: { campo: 'fecha_emision', direccion: 'desc' },
  INVENTARIO: { campo: 'stock_disponible', direccion: 'asc' },
};

const NUMEROS_TEXTO: Record<string, number> = {
  un: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
};

function numeroDeTexto(texto: string): number {
  return NUMEROS_TEXTO[texto] ?? Number(texto);
}

const ETIQUETAS: Record<string, string> = {
  fecha_emision: 'fecha',
  sucursal: 'sucursal',
  producto: 'producto',
  categoria: 'categoría',
  monto_total: 'monto total',
  cantidad: 'cantidad',
  almacen: 'almacén',
  variante: 'variante',
  stock_disponible: 'stock disponible',
  en_stock_critico: 'stock crítico',
  proveedor: 'proveedor',
  total: 'total',
};

/**
 * Traductor simplificado de pedidos en lenguaje natural (CU18) a la config
 * del Report Builder. No usa ML: reconoce palabras clave en español
 * (tipo de reporte, sucursal, período, top-N, stock crítico) y construye un
 * ReportRunRequest válido. Es lo que ejecuta el reporte generado por voz.
 */
@Injectable()
export class ReporteNlpService {
  constructor(private readonly dataSource: DataSource) {}

  async interpretar(promptUsuario: string): Promise<InterpretacionPrompt> {
    const prompt = normalizarTexto(promptUsuario.trim() || '');
    const partes: string[] = [];

    const tipo = this.detectarTipo(prompt);
    const { desde, hasta, periodoTexto } = this.detectarPeriodo(prompt);
    const { sucursal, limite, esTop, esCritico } = await this.detectarContexto(prompt, tipo);

    const request: ReportRunRequestDto = {
      reportType: tipo,
      selectedFields: [...CAMPOS_POR_TIPO[tipo]],
      filters: [
        ...(sucursal ? ([{ campo: 'sucursal', operador: 'eq' as const, valor: sucursal }] as ReportFilterDto[]) : []),
        ...(esCritico ? ([{ campo: 'en_stock_critico', operador: 'eq' as const, valor: true }] as ReportFilterDto[]) : []),
      ],
      sort: esTop ? { campo: 'cantidad', direccion: 'desc' } : ORDEN_POR_DEFECTO[tipo],
      dateFrom: desde,
      dateTo: hasta,
      limit: limite,
      offset: 0,
    };

    partes.push(`Reporte de ${NOMBRE_POR_TIPO[tipo]}`);
    partes.push(`columnas: ${request.selectedFields.map((campo) => ETIQUETAS[campo] ?? campo).join(', ')}`);
    if (sucursal) partes.push(`sucursal "${sucursal}"`);
    if (periodoTexto) partes.push(`período: ${periodoTexto}`);
    if (esTop) partes.push(`las ${limite} primeras por cantidad vendida`);
    if (esCritico) partes.push('solo stock crítico');
    if (!sucursal && !periodoTexto && !esTop && !esCritico) {
      partes.push('(no se reconocieron instrucciones específicas, se muestran las ventas recientes)');
    }

    return { request, interpretacion: partes.join(' · ') };
  }

  private detectarTipo(prompt: string): 'VENTAS' | 'INVENTARIO' | 'COMPRAS' {
    if (/inventario|stock|existencia|agotad|stockcritico/.test(prompt)) return 'INVENTARIO';
    if (/compra|proveedor|factura/.test(prompt)) return 'COMPRAS';
    return 'VENTAS';
  }

  private detectarPeriodo(prompt: string): { desde?: string; hasta?: string; periodoTexto?: string } {
    const hoy = new Date();
    const iso = (fecha: Date) => fecha.toISOString().slice(0, 10);
    const diasAtras = (dias: number) => {
      const fecha = new Date(hoy);
      fecha.setDate(fecha.getDate() - dias);
      return iso(fecha);
    };

    if (/hoy/.test(prompt)) return { desde: iso(hoy), hasta: iso(hoy), periodoTexto: 'hoy' };

    if (/mes/.test(prompt) && /ultimo|pasado/.test(prompt)) {
      const haceUnMes = new Date(hoy);
      haceUnMes.setMonth(haceUnMes.getMonth() - 1);
      return { desde: iso(haceUnMes), hasta: iso(hoy), periodoTexto: 'el último mes' };
    }

    // "dos semanas" también hay que reconocerlo: antes solo se fijaba en si
    // aparecía la palabra "semana" (sin mirar la cantidad), así que "últimas
    // dos semanas" se interpretaba igual que "la última semana" (7 días en
    // vez de 14). PATRON_NUMERO acepta dígito o número en palabras (dos, tres...).
    const PATRON_NUMERO = '(\\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)';

    const coincidenciaSemanas = prompt.match(new RegExp(`${PATRON_NUMERO}\\s*semanas?`));
    if (coincidenciaSemanas) {
      const semanas = Math.max(1, numeroDeTexto(coincidenciaSemanas[1]));
      const dias = Math.min(365, semanas * 7);
      return { desde: diasAtras(dias - 1), hasta: iso(hoy), periodoTexto: `las últimas ${semanas} semana${semanas === 1 ? '' : 's'}` };
    }

    const coincidenciaDias = prompt.match(new RegExp(`${PATRON_NUMERO}\\s*dias?`));
    if (coincidenciaDias) {
      const dias = Math.max(1, Math.min(365, numeroDeTexto(coincidenciaDias[1])));
      return { desde: diasAtras(dias - 1), hasta: iso(hoy), periodoTexto: `los últimos ${dias} días` };
    }

    if (/semana/.test(prompt)) return { desde: diasAtras(6), hasta: iso(hoy), periodoTexto: 'la última semana' };
    return {};
  }

  private async detectarContexto(
    prompt: string,
    tipo: 'VENTAS' | 'INVENTARIO' | 'COMPRAS',
  ): Promise<{ sucursal?: string; limite: number; esTop: boolean; esCritico: boolean }> {
    let limite = 50;
    const maximo = prompt.match(/(\d+)\s*(prendas|productos|variantes|articulos)/) ?? prompt.match(/las?\s*(\d+)\s*(mas vendidas|mas vendidos|primeras|principales)/);
    if (maximo) limite = Math.max(1, Math.min(LIMITE_NLP_MAXIMO, Number(maximo[1])));

    const esTop = tipo === 'VENTAS' && /mas vendidas|mas vendidos|top|primeras/.test(prompt);
    const esCritico = tipo === 'INVENTARIO' && /critico/.test(prompt);

    const sucursales = await this.dataSource.query<Array<{ nombre: string }>>(
      'SELECT nombre FROM sucursal WHERE activo = true ORDER BY nombre',
    );
    let sucursal: string | undefined;
    for (const sucursalActual of sucursales) {
      if (prompt.includes(normalizarTexto(sucursalActual.nombre))) {
        sucursal = sucursalActual.nombre;
        break;
      }
    }

    return { sucursal, limite, esTop, esCritico };
  }
}