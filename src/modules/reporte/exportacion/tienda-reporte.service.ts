import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantContext } from '../../../common/tenant/tenant-context.service.js';
import type { TiendaReporte } from './pdf-reporte.js';

/** Solo archivos de imagen subidos a esta misma instancia: PDFKit lee PNG y JPEG. */
const ARCHIVO_LOGO = /^[\w-]+\.(png|jpe?g)$/i;

/**
 * Nombre, logo y color de la tienda actual para el encabezado del PDF y el Excel.
 *
 * El logo solo se toma si es una imagen de /uploads de esta misma instancia (lo que guarda archivos.controller), leida
 * del disco: nunca se descarga una URL externa, que permitiria hacer que el servidor pida cualquier direccion.
 */
@Injectable()
export class TiendaReporteService {
  private readonly logger = new Logger(TiendaReporteService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly tenant: TenantContext,
  ) {}

  async actual(): Promise<TiendaReporte> {
    const [fila] = await this.dataSource.query<Array<{ nombre: string; logo_url: string | null; color_primario: string | null }>>(
      'SELECT nombre, logo_url, color_primario FROM empresa WHERE id = $1',
      [this.tenant.empresaId()],
    );
    return {
      nombre: fila?.nombre ?? this.tenant.empresa()?.nombre ?? 'Tienda',
      logo: await this.leerLogo(fila?.logo_url ?? null),
      color: fila?.color_primario ?? null,
    };
  }

  private async leerLogo(url: string | null): Promise<Buffer | null> {
    const archivo = url?.match(/\/uploads\/([^/?#]+)$/)?.[1];
    if (!archivo || !ARCHIVO_LOGO.test(archivo)) return null;
    try {
      return await readFile(join(process.cwd(), 'uploads', basename(archivo)));
    } catch {
      this.logger.warn(`No se encontro el logo de la tienda (${archivo}); el PDF usa sus iniciales`);
      return null;
    }
  }
}
