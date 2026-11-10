import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../../config/configuration.js';

export interface PedidoPronosticoMl {
  idEmpresa: number;
  ambito: 'TOTAL' | 'SUCURSAL' | 'CATEGORIA';
  clave?: string;
  frecuencia: 'MENSUAL' | 'SEMANAL';
  horizonte: number;
}

export interface RespuestaPronosticoMl {
  disponible: boolean;
  motivo?: string;
  modelo?: string;
  mape?: number | null;
  puntos?: Array<{ periodo: string; valor: number; bajo: number; alto: number }>;
}

const TIMEOUT_MS = 15_000;

/** Pronosticos al momento en el servicio ml/, para horizontes mas largos que los ya calculados. */
@Injectable()
export class MlClienteService {
  private readonly logger = new Logger(MlClienteService.name);
  private readonly bi: AppConfig['bi'];

  constructor(config: ConfigService<AppConfig, true>) {
    this.bi = config.get('bi', { infer: true });
  }

  async pronostico(pedido: PedidoPronosticoMl): Promise<RespuestaPronosticoMl> {
    if (this.bi.mlClaveInterna === '') return { disponible: false, motivo: 'El servicio de machine learning no esta configurado' };
    try {
      const respuesta = await fetch(`${this.bi.mlUrl}/pronostico`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Clave-Interna': this.bi.mlClaveInterna },
        body: JSON.stringify(pedido),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!respuesta.ok) throw new Error(`respondio ${respuesta.status}`);
      return (await respuesta.json()) as RespuestaPronosticoMl;
    } catch (error) {
      this.logger.warn(`Pronostico al momento no disponible: ${error instanceof Error ? error.message : String(error)}`);
      return { disponible: false, motivo: 'El servicio de machine learning no respondio' };
    }
  }
}
