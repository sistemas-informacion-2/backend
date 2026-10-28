import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import type { AppConfig } from '../../../config/configuration.js';

/** Stripe no cobra menos de 0.50 en la moneda de cobro (50 unidades menores en USD/EUR). */
const MINIMO_UNIDADES_MENORES = 50;

export interface SesionStripe {
  id: string;
  /** `open`, `complete` o `expired`. */
  status: string;
  /** `client_reference_id` que se envio al crear la sesion (identifica al cliente). */
  referencia: string;
  moneda: string;
  /** Monto autorizado en unidades menores (centavos). */
  montoMinor: number;
  paymentIntentId: string | null;
  /** `requires_capture` cuando el cliente ya autorizo la tarjeta y falta cobrar. */
  paymentIntentStatus: string | null;
}

/**
 * Cliente de Stripe Checkout. La sesion se crea con captura manual: el cliente solo autoriza la tarjeta en la
 * pagina de Stripe y el cobro real (`capturar`) ocurre al final de la transaccion del checkout.
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private cliente: Stripe | null = null;

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  get configurado(): boolean {
    return this.config.get('stripe.secretKey', { infer: true }) !== '';
  }

  get modoPruebas(): boolean {
    return this.config.get('stripe.secretKey', { infer: true }).startsWith('sk_test_');
  }

  /** Codigo ISO en minusculas, como lo devuelve Stripe (`usd`). */
  get moneda(): string {
    return this.config.get('stripe.currency', { infer: true });
  }

  /** El monto en Bs se cobra como su equivalente en la moneda configurada, en unidades menores (centavos). */
  aMonedaStripe(montoBob: number): number {
    const tasa = this.config.get('stripe.bobRate', { infer: true });
    return Math.round((montoBob / tasa) * 100);
  }

  async crearSesion(datos: { referencia: string; montoBob: number; descripcion: string; urlRetorno: string; urlCancelado: string }): Promise<{ id: string; url: string; monto: number }> {
    const montoMinor = this.aMonedaStripe(datos.montoBob);
    if (montoMinor < MINIMO_UNIDADES_MENORES) {
      throw new ServiceUnavailableException('El monto es demasiado pequeño para cobrarlo con Stripe');
    }

    // Stripe reemplaza {CHECKOUT_SESSION_ID} por el id real; la pagina de retorno lo usa para confirmar.
    const separador = datos.urlRetorno.includes('?') ? '&' : '?';
    const sesion = await this.llamar('crear la sesion de pago', () =>
      this.stripe.checkout.sessions.create({
        mode: 'payment',
        client_reference_id: datos.referencia,
        line_items: [
          {
            quantity: 1,
            price_data: { currency: this.moneda, unit_amount: montoMinor, product_data: { name: datos.descripcion.slice(0, 250) } },
          },
        ],
        payment_intent_data: { capture_method: 'manual', description: datos.descripcion.slice(0, 250), metadata: { referencia: datos.referencia } },
        success_url: `${datos.urlRetorno}${separador}session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: datos.urlCancelado,
      }),
    );

    if (!sesion.url) throw new BadGatewayException('Stripe no devolvio el enlace de pago');
    return { id: sesion.id, url: sesion.url, monto: montoMinor / 100 };
  }

  async obtenerSesion(id: string): Promise<SesionStripe> {
    const sesion = await this.llamar('consultar la sesion de pago', () =>
      this.stripe.checkout.sessions.retrieve(id, { expand: ['payment_intent'] }),
    );
    const intento = typeof sesion.payment_intent === 'object' ? sesion.payment_intent : null;
    return {
      id: sesion.id,
      status: sesion.status ?? '',
      referencia: sesion.client_reference_id ?? '',
      moneda: sesion.currency ?? '',
      montoMinor: sesion.amount_total ?? 0,
      paymentIntentId: intento?.id ?? (typeof sesion.payment_intent === 'string' ? sesion.payment_intent : null),
      paymentIntentStatus: intento?.status ?? null,
    };
  }

  /** Cobra lo que el cliente autorizo. La clave de idempotencia evita cobrar dos veces el mismo pago. */
  async capturar(paymentIntentId: string): Promise<{ capturaId: string }> {
    const intento = await this.llamar('cobrar el pago', () =>
      this.stripe.paymentIntents.capture(paymentIntentId, {}, { idempotencyKey: `captura-${paymentIntentId}` }),
    );
    if (intento.status !== 'succeeded') throw new BadGatewayException('Stripe no confirmo el cobro; no se te cargo nada');
    return { capturaId: intento.id };
  }

  /** Libera la retencion de la tarjeta cuando la compra no se pudo registrar. Si falla, la autorizacion vence sola. */
  async cancelar(paymentIntentId: string): Promise<void> {
    try {
      await this.stripe.paymentIntents.cancel(paymentIntentId);
    } catch (error) {
      this.logger.warn(`No se pudo liberar la autorizacion ${paymentIntentId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private get stripe(): Stripe {
    if (!this.configurado) throw new ServiceUnavailableException('Stripe no esta configurado');
    this.cliente ??= new Stripe(this.config.get('stripe.secretKey', { infer: true }), { timeout: 20_000, maxNetworkRetries: 2 });
    return this.cliente;
  }

  private async llamar<T>(accion: string, operacion: () => Promise<T>): Promise<T> {
    try {
      return await operacion();
    } catch (error) {
      if (error instanceof Stripe.errors.StripeConnectionError) {
        this.logger.error(`Stripe no respondio al ${accion}: ${error.message}`);
        throw new BadGatewayException('No se pudo conectar con Stripe. Intenta de nuevo en unos minutos');
      }
      if (error instanceof Stripe.errors.StripeAuthenticationError) {
        this.logger.error(`Stripe rechazo la llave al ${accion}: ${error.message}`);
        throw new ServiceUnavailableException('No se pudo autenticar con Stripe; revisa la llave secreta');
      }
      if (error instanceof Stripe.errors.StripeError) {
        this.logger.warn(`Stripe rechazo ${accion}: ${error.message}`);
        throw new BadGatewayException(`Stripe rechazo la operacion: ${error.message}`);
      }
      throw error;
    }
  }
}
