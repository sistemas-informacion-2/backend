import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import type { AppConfig } from '../../../config/configuration.js';
import { TenantContext } from '../../../common/tenant/tenant-context.service.js';
import { GeminiBiClient, type ModoIa } from '../agente/gemini.client.js';

export interface EstadoBiDto {
  ia: { modo: ModoIa; modelo: string };
  ml: {
    configurado: boolean;
    ultimaEjecucion: { estado: string; inicio: Date; fin: Date | null; metricas: Record<string, unknown> | null; error: string | null } | null;
  };
  dw: { disponible: boolean; calendario: { desde: string; hasta: string } | null };
  etl: {
    programado: boolean;
    ultimaEjecucion: { estado: string; origen: string; inicio: Date; fin: Date | null; filas: Record<string, number> | null; error: string | null } | null;
  };
}

/** Que tan listo esta el BI de la empresa actual: IA configurada, DW creado y ultima carga. */
@Injectable()
export class BiEstadoService {
  private readonly bi: AppConfig['bi'];

  constructor(
    private readonly dataSource: DataSource,
    private readonly tenant: TenantContext,
    private readonly gemini: GeminiBiClient,
    config: ConfigService<AppConfig, true>,
  ) {
    this.bi = config.get('bi', { infer: true });
  }

  async estado(): Promise<EstadoBiDto> {
    const [{ existe }] = await this.dataSource.query<Array<{ existe: boolean }>>(`SELECT to_regclass('dw.dim_fecha') IS NOT NULL AS existe`);
    let calendario: EstadoBiDto['dw']['calendario'] = null;
    let ultima: EstadoBiDto['etl']['ultimaEjecucion'] = null;
    let ultimaMl: EstadoBiDto['ml']['ultimaEjecucion'] = null;
    if (existe) {
      const [rango] = await this.dataSource.query<Array<{ desde: string | null; hasta: string | null }>>(
        `SELECT min(fecha)::text AS desde, max(fecha)::text AS hasta FROM dw.dim_fecha`,
      );
      calendario = rango.desde && rango.hasta ? { desde: rango.desde, hasta: rango.hasta } : null;
      const [fila] = await this.dataSource.query<Array<NonNullable<EstadoBiDto['etl']['ultimaEjecucion']>>>(
        `SELECT estado, origen, inicio, fin, filas, error FROM dw.etl_ejecucion WHERE id_empresa = $1 ORDER BY inicio DESC LIMIT 1`,
        [this.tenant.empresaId()],
      );
      ultima = fila ?? null;
      const [filaMl] = await this.dataSource.query<Array<NonNullable<EstadoBiDto['ml']['ultimaEjecucion']>>>(
        `SELECT estado, inicio, fin, metricas, error FROM dw.ml_ejecucion WHERE id_empresa = $1 ORDER BY inicio DESC, id DESC LIMIT 1`,
        [this.tenant.empresaId()],
      );
      ultimaMl = filaMl ?? null;
    }
    return {
      ia: { modo: this.gemini.modo(), modelo: this.gemini.modelo() },
      ml: { configurado: this.bi.mlClaveInterna !== '', ultimaEjecucion: ultimaMl },
      dw: { disponible: existe, calendario },
      etl: { programado: this.bi.etlProgramado, ultimaEjecucion: ultima },
    };
  }
}
