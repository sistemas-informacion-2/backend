import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../../config/configuration.js';

const TIMEOUT_MS = 10_000;

/**
 * Avisa al servicio de machine learning (ml/, Python) que el DW de una empresa se acaba de cargar, para que vuelva a
 * entrenar sus modelos. Sin ML_CLAVE_INTERNA no hace nada. Un fallo del aviso no hace fallar la carga: el BI sigue
 * con los ultimos resultados de los modelos.
 */
@Injectable()
export class AvisoMlService {
  private readonly logger = new Logger(AvisoMlService.name);
  private readonly bi: AppConfig['bi'];

  constructor(config: ConfigService<AppConfig, true>) {
    this.bi = config.get('bi', { infer: true });
  }

  configurado(): boolean {
    return this.bi.mlClaveInterna !== '';
  }

  async cargaTerminada(idEmpresa: number): Promise<void> {
    if (!this.configurado()) return;
    try {
      const respuesta = await fetch(`${this.bi.mlUrl}/entrenar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Clave-Interna': this.bi.mlClaveInterna },
        body: JSON.stringify({ idEmpresa }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!respuesta.ok) this.logger.warn(`El servicio de ML respondio ${respuesta.status} al aviso de la empresa ${idEmpresa}`);
    } catch (error) {
      this.logger.warn(`No se pudo avisar al servicio de ML (empresa ${idEmpresa}): ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
