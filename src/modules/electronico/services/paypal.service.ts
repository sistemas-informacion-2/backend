import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../../config/configuration.js';

const URL_BASE = { sandbox: 'https://api-m.sandbox.paypal.com', live: 'https://api-m.paypal.com' } as const;

export interface OrdenPaypal {
  id: string;
  status: string;
  /** `reference_id` que se envio al crear la orden (identifica al cliente). */
  referenceId: string;
  moneda: string;
  monto: string;
}

interface RespuestaPaypal {
  id?: string;
  status?: string;
  links?: Array<{ rel: string; href: string }>;
  purchase_units?: Array<{
    reference_id?: string;
    amount?: { currency_code: string; value: string };
    payments?: { captures?: Array<{ id: string; status: string }> };
  }>;
  access_token?: string;
  expires_in?: number;
  message?: string;
  name?: string;
  details?: Array<{ issue?: string; description?: string }>;
}

/** Cliente minimo de la API REST v2 de PayPal (ordenes y captura). Las credenciales salen del .env. */
@Injectable()
export class PaypalService {
  private readonly logger = new Logger(PaypalService.name);
  private token: { valor: string; expiraEn: number } | null = null;

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  get configurado(): boolean {
    const { clientId, clientSecret } = this.config.get('paypal', { infer: true });
    return clientId !== '' && clientSecret !== '';
  }

  get moneda(): string {
    return this.config.get('paypal.currency', { infer: true });
  }

  /** PayPal no opera BOB: el monto en Bs se cobra como su equivalente en la moneda configurada (USD). */
  aMonedaPaypal(montoBob: number): number {
    const tasa = this.config.get('paypal.bobRate', { infer: true });
    return Math.round((montoBob / tasa + Number.EPSILON) * 100) / 100;
  }

  async crearOrden(datos: { referencia: string; montoBob: number; descripcion: string; urlRetorno: string; urlCancelado: string }): Promise<{ id: string; urlAprobacion: string; monto: number }> {
    const monto = this.aMonedaPaypal(datos.montoBob);
    if (monto < 0.01) throw new ServiceUnavailableException('El monto es demasiado pequeño para cobrarlo con PayPal');

    const respuesta = await this.solicitar('POST', '/v2/checkout/orders', {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: datos.referencia,
          description: datos.descripcion.slice(0, 127),
          amount: { currency_code: this.moneda, value: monto.toFixed(2) },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: 'FashionStore',
            user_action: 'PAY_NOW',
            shipping_preference: 'NO_SHIPPING',
            return_url: datos.urlRetorno,
            cancel_url: datos.urlCancelado,
          },
        },
      },
    });

    const urlAprobacion = respuesta.links?.find((link) => link.rel === 'payer-action' || link.rel === 'approve')?.href;
    if (!respuesta.id || !urlAprobacion) throw new BadGatewayException('PayPal no devolvio el enlace de pago');
    return { id: respuesta.id, urlAprobacion, monto };
  }

  async obtenerOrden(id: string): Promise<OrdenPaypal> {
    const respuesta = await this.solicitar('GET', `/v2/checkout/orders/${encodeURIComponent(id)}`);
    const unidad = respuesta.purchase_units?.[0];
    return {
      id: respuesta.id ?? id,
      status: respuesta.status ?? '',
      referenceId: unidad?.reference_id ?? '',
      moneda: unidad?.amount?.currency_code ?? '',
      monto: unidad?.amount?.value ?? '0',
    };
  }

  /** Cobra una orden ya aprobada por el cliente. El `PayPal-Request-Id` hace la captura idempotente. */
  async capturar(id: string): Promise<{ capturaId: string }> {
    const respuesta = await this.solicitar('POST', `/v2/checkout/orders/${encodeURIComponent(id)}/capture`, {}, { 'PayPal-Request-Id': `captura-${id}` });
    const captura = respuesta.purchase_units?.[0]?.payments?.captures?.[0];
    if (respuesta.status !== 'COMPLETED' || !captura || captura.status !== 'COMPLETED') {
      throw new BadGatewayException('PayPal no confirmo el cobro; no se te cargo nada');
    }
    return { capturaId: captura.id };
  }

  private async obtenerToken(): Promise<string> {
    if (this.token && this.token.expiraEn > Date.now() + 60_000) return this.token.valor;

    const { clientId, clientSecret } = this.config.get('paypal', { infer: true });
    const credenciales = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const respuesta = await this.llamar('POST', '/v1/oauth2/token', {
      Authorization: `Basic ${credenciales}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    }, 'grant_type=client_credentials');

    if (!respuesta.access_token) throw new ServiceUnavailableException('No se pudo autenticar con PayPal; revisa las credenciales');
    this.token = { valor: respuesta.access_token, expiraEn: Date.now() + (respuesta.expires_in ?? 300) * 1000 };
    return this.token.valor;
  }

  private async solicitar(metodo: 'GET' | 'POST', ruta: string, cuerpo?: unknown, cabeceras: Record<string, string> = {}): Promise<RespuestaPaypal> {
    if (!this.configurado) throw new ServiceUnavailableException('PayPal no esta configurado');
    return this.llamar(
      metodo,
      ruta,
      { Authorization: `Bearer ${await this.obtenerToken()}`, 'Content-Type': 'application/json', ...cabeceras },
      cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    );
  }

  private async llamar(metodo: string, ruta: string, cabeceras: Record<string, string>, cuerpo?: string): Promise<RespuestaPaypal> {
    const base = URL_BASE[this.config.get('paypal.mode', { infer: true })];
    let respuesta: Response;
    try {
      respuesta = await fetch(`${base}${ruta}`, { method: metodo, headers: cabeceras, body: cuerpo, signal: AbortSignal.timeout(20_000) });
    } catch (error) {
      this.logger.error(`PayPal no respondio (${metodo} ${ruta}): ${error instanceof Error ? error.message : String(error)}`);
      throw new BadGatewayException('No se pudo conectar con PayPal. Intenta de nuevo en unos minutos');
    }

    const datos = (await respuesta.json().catch(() => ({}))) as RespuestaPaypal;
    if (!respuesta.ok) {
      const detalle = datos.details?.[0]?.description ?? datos.message ?? datos.name ?? `HTTP ${respuesta.status}`;
      this.logger.warn(`PayPal rechazo ${metodo} ${ruta}: ${detalle}`);
      throw new BadGatewayException(`PayPal rechazo la operacion: ${detalle}`);
    }
    return datos;
  }
}
