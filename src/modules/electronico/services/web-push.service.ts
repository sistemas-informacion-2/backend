import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import webpush from 'web-push';
import type { AppConfig } from '../../../config/configuration.js';
import type { SuscripcionWebPush } from '../entities/suscripcion-web-push.entity.js';
import { SuscripcionWebPushRepository } from '../repositories/suscripcion-web-push.repository.js';

export interface MensajeWebPush {
  suscripcion: Pick<SuscripcionWebPush, 'endpoint' | 'p256dh' | 'auth'>;
  titulo: string;
  mensaje: string;
  url: string;
  /** Avisos con la misma etiqueta se reemplazan en vez de acumularse. */
  etiqueta: string;
}

const ENVIOS_SIMULTANEOS = 20;
const VIGENCIA_SEGUNDOS = 24 * 60 * 60;
const MAX_MENSAJE = 500;
/** El navegador puede tener hasta 4 KB de carga; ademas, el servicio push responde 404 o 410 si la suscripcion vencio. */
const CODIGOS_VENCIDA = [404, 410];
/** El servidor hace POST a esta direccion: solo se aceptan los servicios push de los navegadores. */
const HOSTS_PUSH = ['fcm.googleapis.com', 'android.googleapis.com', '.push.services.mozilla.com', '.notify.windows.com', '.push.apple.com'];

export function esEndpointDePush(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && HOSTS_PUSH.some((host) => (host.startsWith('.') ? url.hostname.endsWith(host) : url.hostname === host));
  } catch {
    return false;
  }
}

/**
 * Envia notificaciones del navegador por Web Push (VAPID): las recibe aunque la pagina este cerrada. Nunca lanza: la
 * notificacion ya esta guardada en BD y se ve al abrir la tienda.
 */
@Injectable()
export class WebPushService {
  private readonly logger = new Logger(WebPushService.name);

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly suscripciones: SuscripcionWebPushRepository,
  ) {}

  get habilitado(): boolean {
    const { publicKey, privateKey } = this.config.get('webPush', { infer: true });
    return publicKey !== '' && privateKey !== '';
  }

  get clavePublica(): string | null {
    return this.habilitado ? this.config.get('webPush', { infer: true }).publicKey : null;
  }

  /** Devuelve cuantos avisos acepto el servicio push. */
  async enviar(mensajes: MensajeWebPush[]): Promise<number> {
    if (!this.habilitado || mensajes.length === 0) return 0;

    const vencidas: string[] = [];
    let aceptados = 0;
    for (let inicio = 0; inicio < mensajes.length; inicio += ENVIOS_SIMULTANEOS) {
      await Promise.all(
        mensajes.slice(inicio, inicio + ENVIOS_SIMULTANEOS).map(async (mensaje) => {
          const resultado = await this.enviarUno(mensaje);
          if (resultado === 'vencida') vencidas.push(mensaje.suscripcion.endpoint);
          if (resultado === 'aceptado') aceptados += 1;
        }),
      );
    }
    await this.suscripciones.eliminarPorEndpoints(vencidas).catch((error: unknown) => this.registrarError(error));
    return aceptados;
  }

  private async enviarUno({ suscripcion, titulo, mensaje, url, etiqueta }: MensajeWebPush): Promise<'aceptado' | 'vencida' | 'fallido'> {
    const { publicKey, privateKey, subject } = this.config.get('webPush', { infer: true });
    try {
      await webpush.sendNotification(
        { endpoint: suscripcion.endpoint, keys: { p256dh: suscripcion.p256dh, auth: suscripcion.auth } },
        JSON.stringify({ titulo, mensaje: mensaje.slice(0, MAX_MENSAJE), url, etiqueta }),
        { TTL: VIGENCIA_SEGUNDOS, vapidDetails: { subject, publicKey, privateKey }, timeout: 15_000 },
      );
      return 'aceptado';
    } catch (error) {
      const codigo = (error as { statusCode?: number }).statusCode;
      if (codigo !== undefined && CODIGOS_VENCIDA.includes(codigo)) return 'vencida';
      this.registrarError(error);
      return 'fallido';
    }
  }

  private registrarError(error: unknown): void {
    this.logger.error(`No se pudo enviar el push web: ${error instanceof Error ? error.message : String(error)}`);
  }
}
