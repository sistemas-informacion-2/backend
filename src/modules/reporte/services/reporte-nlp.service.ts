import { Injectable } from '@nestjs/common';
import { fechaLocal, inicioDeMes, sumarDias, sumarMeses } from '../../../common/utils/fecha.util.js';
import { DataSource } from 'typeorm';
import { TenantContext } from '../../../common/tenant/tenant-context.service.js';
import { normalizarTexto } from '../catalog/reporte-catalog.constants.js';
import { LIMITE_REPORTE_MAXIMO, type ReportFilterDto, type ReportRunRequestDto } from '../dto/reporte-builder.dto.js';

export interface InterpretacionPrompt {
  request: ReportRunRequestDto;
  interpretacion: string;
}

/** Filas por pagina; una cantidad pedida ("top N") va aparte, en `top`. */
const LIMITE_PAGINA = 50;

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
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenant: TenantContext,
  ) {}

  async interpretar(promptUsuario: string): Promise<InterpretacionPrompt> {
    const prompt = normalizarTexto(promptUsuario.trim() || '');
    const partes: string[] = [];

    const tipo = this.detectarTipo(prompt);
    const { desde, hasta, periodoTexto } = this.detectarPeriodo(prompt);
    const { sucursal, top, esTop, esCritico } = await this.detectarContexto(prompt, tipo);

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
      // Una cantidad pedida ("las 5 prendas") es un top, no el tamano de pagina.
      limit: top ? Math.min(top, LIMITE_PAGINA) : LIMITE_PAGINA,
      offset: 0,
      ...(top ? { top } : {}),
    };

    partes.push(`Reporte de ${NOMBRE_POR_TIPO[tipo]}`);
    partes.push(`columnas: ${request.selectedFields.map((campo) => ETIQUETAS[campo] ?? campo).join(', ')}`);
    if (sucursal) partes.push(`sucursal "${sucursal}"`);
    if (periodoTexto) partes.push(`período: ${periodoTexto}`);
    if (esTop) partes.push(top ? `las ${top} primeras por cantidad vendida` : 'ordenadas por cantidad vendida');
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
    // Fechas de calendario en Bolivia: "hoy" a las 21:00 en La Paz sigue siendo hoy aunque en UTC ya sea manana.
    const hoy = fechaLocal();
    const diasAtras = (dias: number) => sumarDias(hoy, -dias);

    if (/\bhoy\b/.test(prompt)) return { desde: hoy, hasta: hoy, periodoTexto: 'hoy' };
    if (/\bayer\b/.test(prompt)) return { desde: diasAtras(1), hasta: diasAtras(1), periodoTexto: 'ayer' };

    // "El mes pasado" es el mes calendario anterior completo (en octubre, todo septiembre); "el último mes" son los
    // últimos 30 días hasta hoy. Antes los dos se trataban como lo segundo.
    if (/\bmes (pasado|anterior)\b/.test(prompt)) {
      const inicioMesActual = inicioDeMes(hoy);
      return { desde: sumarMeses(inicioMesActual, -1), hasta: sumarDias(inicioMesActual, -1), periodoTexto: 'el mes pasado' };
    }
    if (/\b(este|del) mes\b|\bmes actual\b/.test(prompt)) return { desde: inicioDeMes(hoy), hasta: hoy, periodoTexto: 'este mes' };
    if (/\bultimo mes\b/.test(prompt)) return { desde: sumarMeses(hoy, -1), hasta: hoy, periodoTexto: 'el último mes' };
    // normalizarTexto quita la tilde de la ñ: "año" llega como "ano".
    if (/\b(este|del) ano\b/.test(prompt)) return { desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy, periodoTexto: 'este año' };

    // "dos semanas" también hay que reconocerlo: antes solo se fijaba en si
    // aparecía la palabra "semana" (sin mirar la cantidad), así que "últimas
    // dos semanas" se interpretaba igual que "la última semana" (7 días en
    // vez de 14). PATRON_NUMERO acepta dígito o número en palabras (dos, tres...).
    const PATRON_NUMERO = '(\\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)';

    const coincidenciaSemanas = prompt.match(new RegExp(`${PATRON_NUMERO}\\s*semanas?`));
    if (coincidenciaSemanas) {
      const semanas = Math.max(1, numeroDeTexto(coincidenciaSemanas[1]));
      const dias = Math.min(365, semanas * 7);
      return { desde: diasAtras(dias - 1), hasta: hoy, periodoTexto: `las últimas ${semanas} semana${semanas === 1 ? '' : 's'}` };
    }

    const coincidenciaDias = prompt.match(new RegExp(`${PATRON_NUMERO}\\s*dias?`));
    if (coincidenciaDias) {
      const dias = Math.max(1, Math.min(365, numeroDeTexto(coincidenciaDias[1])));
      return { desde: diasAtras(dias - 1), hasta: hoy, periodoTexto: `los últimos ${dias} días` };
    }

    if (/semana/.test(prompt)) return { desde: diasAtras(6), hasta: hoy, periodoTexto: 'la última semana' };
    return {};
  }

  private async detectarContexto(
    prompt: string,
    tipo: 'VENTAS' | 'INVENTARIO' | 'COMPRAS',
  ): Promise<{ sucursal?: string; top?: number; esTop: boolean; esCritico: boolean }> {
    let top: number | undefined;
    const maximo =
      prompt.match(/(\d+)\s*(prendas|productos|variantes|articulos)/) ??
      prompt.match(/\bl[ao]s?\s*(\d+)\s*(mas vendid[oa]s|primer[oa]s|principales)/) ??
      prompt.match(/\btop\s*(\d+)/);
    if (maximo) top = Math.max(1, Math.min(LIMITE_REPORTE_MAXIMO, Number(maximo[1])));

    const esTop = tipo === 'VENTAS' && /mas vendid[oa]s|\btop\b|primer[oa]s/.test(prompt);
    const esCritico = tipo === 'INVENTARIO' && /critico/.test(prompt);

    const sucursales = await this.dataSource.query<Array<{ nombre: string }>>(
      'SELECT nombre FROM sucursal WHERE activo = true AND id_empresa = $1 ORDER BY nombre',
      [this.tenant.empresaId()],
    );
    let sucursal: string | undefined;
    for (const sucursalActual of sucursales) {
      if (prompt.includes(normalizarTexto(sucursalActual.nombre))) {
        sucursal = sucursalActual.nombre;
        break;
      }
    }

    return { sucursal, top, esTop, esCritico };
  }
}