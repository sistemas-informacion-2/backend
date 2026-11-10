import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager } from 'typeorm';
import { ahora } from '../../../common/utils/reloj.js';
import { StripeService } from '../../electronico/services/stripe.service.js';
import { PagoPlan } from '../entities/pago-plan.entity.js';

/** Referencia que viaja a Stripe (client_reference_id): asi la sesion no sirve para confirmar otro pago. */
function referencia(pago: PagoPlan): string {
  return `PLAN-${pago.id}`;
}

export interface SesionAbierta {
  url: string;
  /** Lo que cobra Stripe, en su moneda. */
  montoCobrado: number;
  monedaCobro: string;
}

/**
 * Cobro de un plan con Stripe Checkout, con el mismo patron que el checkout de la tienda: Stripe solo autoriza la
 * tarjeta; al volver, se aplica el pago (crear la empresa o extender el plan) en una transaccion y el cobro real
 * es su ultimo paso. Si algo falla, no se cobra y se libera la autorizacion.
 */
@Injectable()
export class CobroPlanService {
  private readonly logger = new Logger(CobroPlanService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly stripe: StripeService,
  ) {}

  /** Crea la sesion de pago de `pago` (ya guardado como PENDIENTE) y la deja anotada en la fila. */
  async abrirSesion(pago: PagoPlan, datos: { descripcion: string; urlRetorno: string; urlCancelado: string }): Promise<SesionAbierta> {
    const sesion = await this.stripe.crearSesion({
      referencia: referencia(pago),
      montoBob: pago.monto,
      descripcion: datos.descripcion,
      urlRetorno: datos.urlRetorno,
      urlCancelado: datos.urlCancelado,
    });
    await this.dataSource.getRepository(PagoPlan).update({ id: pago.id }, { stripeSessionId: sesion.id });
    return { url: sesion.url, montoCobrado: sesion.monto, monedaCobro: this.stripe.moneda.toUpperCase() };
  }

  /**
   * Confirma el pago de la sesion `sessionId`. Idempotente: si ya se aplico, solo devuelve la fila.
   *
   * @param pertenece revisa que la fila sea del flujo que confirma (un alta, o la empresa del request).
   * @param aplicar lo que compra el pago, dentro de la transaccion y con la fila bloqueada.
   */
  async confirmar(
    sessionId: string,
    pertenece: (pago: PagoPlan) => boolean,
    aplicar: (manager: EntityManager, pago: PagoPlan) => Promise<void>,
  ): Promise<PagoPlan> {
    const repo = this.dataSource.getRepository(PagoPlan);
    const pago = await repo.findOne({ where: { stripeSessionId: sessionId }, relations: { plan: true } });
    if (!pago || !pertenece(pago)) throw new NotFoundException('No se encontró el pago');
    if (pago.estado === 'PAGADO') return pago;
    if (pago.estado === 'FALLIDO') {
      throw new ConflictException(`El pago no se pudo completar${pago.detalleError ? `: ${pago.detalleError}` : ''}. No se te cobró nada.`);
    }

    const sesion = await this.stripe.obtenerSesion(sessionId);
    if (sesion.referencia !== referencia(pago)) throw new BadRequestException('La sesión de pago no corresponde a este cobro');
    if (sesion.montoMinor !== this.stripe.aMonedaStripe(pago.monto)) throw new BadRequestException('El monto pagado no coincide con el del plan');
    if (sesion.status !== 'complete' || sesion.paymentIntentStatus !== 'requires_capture' || !sesion.paymentIntentId) {
      throw new BadRequestException('El pago todavía no se completó en Stripe');
    }
    const paymentIntentId = sesion.paymentIntentId;

    try {
      await this.dataSource.transaction(async (manager) => {
        // Dos pestanas confirmando a la vez: la segunda espera aqui y encuentra la fila ya pagada.
        const bloqueado = await manager.getRepository(PagoPlan).findOne({ where: { id: pago.id }, lock: { mode: 'pessimistic_write' } });
        if (!bloqueado || bloqueado.estado === 'PAGADO') return;
        bloqueado.plan = pago.plan;

        await aplicar(manager, bloqueado);
        bloqueado.estado = 'PAGADO';
        bloqueado.fechaPago = ahora();
        bloqueado.stripePaymentIntentId = paymentIntentId;
        await manager.getRepository(PagoPlan).save(bloqueado);

        // Ultimo paso: si Stripe no cobra, la transaccion se revierte y no queda nada aplicado.
        await this.stripe.capturar(paymentIntentId);
      });
    } catch (error) {
      const detalle = error instanceof Error ? error.message : String(error);
      this.logger.warn(`No se pudo confirmar el pago de plan ${pago.id}: ${detalle}`);
      await this.stripe.cancelar(paymentIntentId);
      await repo.update({ id: pago.id, estado: 'PENDIENTE' }, { estado: 'FALLIDO', detalleError: detalle.slice(0, 255) });
      throw error;
    }

    const confirmado = await repo.findOne({ where: { id: pago.id }, relations: { plan: true } });
    return confirmado!;
  }
}
