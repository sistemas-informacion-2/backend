import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../../config/configuration.js';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Tope de reportes generativos con Gemini por empresa, en las ultimas 24 horas (REPORTES_IA_POR_DIA). La API key de
 * Gemini es una sola para todo el SaaS: sin tope, una tienda podria agotar la cuota de todas.
 *
 * El conteo vive en memoria y no en la base: un reporte generativo no se guarda en ninguna tabla, y para un solo
 * backend alcanza. Si el backend se reinicia, el conteo vuelve a cero (a lo sumo se regala un dia de cuota).
 * Usa la hora real del sistema, no el reloj simulado del generador de historia (ver common/utils/reloj).
 */
@Injectable()
export class CuotaGenerativoService {
  private readonly porDia: number;
  /** Momento (ms) de cada uso reciente, por empresa. Nunca guarda mas de `porDia` por empresa. */
  private readonly usos = new Map<number, number[]>();

  constructor(config: ConfigService<AppConfig, true>) {
    this.porDia = config.get('gemini', { infer: true }).generativosPorDia;
  }

  /** Registra un uso si queda cupo y devuelve true; sin cupo devuelve false y no registra nada. */
  consumir(idEmpresa: number, ahoraMs: number = Date.now()): boolean {
    const recientes = (this.usos.get(idEmpresa) ?? []).filter((momento) => momento > ahoraMs - MS_POR_DIA);
    if (recientes.length >= this.porDia) {
      this.usos.set(idEmpresa, recientes);
      return false;
    }
    recientes.push(ahoraMs);
    this.usos.set(idEmpresa, recientes);
    return true;
  }
}
