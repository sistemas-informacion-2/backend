import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../../config/configuration.js';
import { DispositivoPushRepository } from '../repositories/dispositivo-push.repository.js';

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Expo acepta como maximo 100 mensajes por solicitud. */
export const TAMANO_LOTE_PUSH = 100;

export interface MensajePush {
  token: string;
  titulo: string;
  mensaje: string;
  data: { url: string; idNotificacion: number };
}

interface TicketPush {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

/**
 * Envia notificaciones push por Expo Push Service. Nunca lanza: si falla, quien notifica sigue igual,
 * porque la notificacion ya esta guardada en BD y el cliente la ve al abrir la app.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly dispositivoRepo: DispositivoPushRepository,
  ) {}

  async enviar(mensajes: MensajePush[]): Promise<void> {
    if (!this.config.get('push.enabled', { infer: true }) || mensajes.length === 0) return;

    for (let inicio = 0; inicio < mensajes.length; inicio += TAMANO_LOTE_PUSH) {
      await this.enviarLote(mensajes.slice(inicio, inicio + TAMANO_LOTE_PUSH));
    }
  }

  private async enviarLote(lote: MensajePush[]): Promise<void> {
    try {
      const respuesta = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: this.cabeceras(),
        body: JSON.stringify(
          lote.map((m) => ({ to: m.token, title: m.titulo, body: m.mensaje, sound: 'default', channelId: 'default', data: m.data })),
        ),
        signal: AbortSignal.timeout(15_000),
      });
      if (!respuesta.ok) {
        this.logger.error(`Expo Push respondio ${respuesta.status}: ${await respuesta.text()}`);
        return;
      }
      const { data: tickets = [] } = (await respuesta.json()) as { data?: TicketPush[] };
      await this.procesarTickets(lote, tickets);
    } catch (error) {
      this.logger.error(`No se pudo enviar el lote de push: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** Los tickets llegan en el mismo orden que los mensajes. */
  private async procesarTickets(lote: MensajePush[], tickets: TicketPush[]): Promise<void> {
    const noRegistrados: string[] = [];
    tickets.forEach((ticket, indice) => {
      if (ticket.status !== 'error') return;
      const token = lote[indice]?.token;
      if (ticket.details?.error === 'DeviceNotRegistered' && token) noRegistrados.push(token);
      else this.logger.warn(`Push rechazado (${ticket.details?.error ?? 'sin codigo'}): ${ticket.message ?? ''}`);
    });
    if (noRegistrados.length > 0) await this.dispositivoRepo.desactivarPorTokens(noRegistrados);
  }

  private cabeceras(): Record<string, string> {
    const cabeceras: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    const accessToken = this.config.get('push.accessToken', { infer: true });
    if (accessToken) cabeceras.Authorization = `Bearer ${accessToken}`;
    return cabeceras;
  }
}
