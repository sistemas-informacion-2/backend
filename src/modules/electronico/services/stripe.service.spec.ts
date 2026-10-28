import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import Stripe from 'stripe';
import { StripeService } from './stripe.service.js';

function crearService(cfg: { secretKey?: string } = {}) {
  const valores: Record<string, unknown> = { 'stripe.secretKey': cfg.secretKey ?? 'sk_test_123', 'stripe.currency': 'usd', 'stripe.bobRate': 6.96 };
  const config = { get: (clave: string) => valores[clave] };
  const service = new StripeService(config as never);
  const cliente = {
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' }),
        retrieve: vi.fn().mockResolvedValue({
          id: 'cs_test_1',
          status: 'complete',
          client_reference_id: 'C7-123',
          currency: 'usd',
          amount_total: 2874,
          payment_intent: { id: 'pi_1', status: 'requires_capture' },
        }),
      },
    },
    paymentIntents: {
      capture: vi.fn().mockResolvedValue({ id: 'pi_1', status: 'succeeded' }),
      cancel: vi.fn().mockResolvedValue({ id: 'pi_1', status: 'canceled' }),
    },
  };
  // El cliente real se crea perezosamente; se reemplaza por uno falso para no llamar a Stripe.
  (service as unknown as { cliente: unknown }).cliente = cliente;
  return { service, cliente };
}

const datosSesion = {
  referencia: 'C7-123',
  montoBob: 200,
  descripcion: 'Compra en FashionStore (2 prendas)',
  urlRetorno: 'http://localhost:5173/checkout/stripe/retorno',
  urlCancelado: 'http://localhost:5173/checkout/stripe/cancelado',
};

describe('StripeService', () => {
  it('convierte Bs a centavos de la moneda de cobro', () => {
    const { service } = crearService();

    expect(service.aMonedaStripe(200)).toBe(2874);
    expect(service.aMonedaStripe(40)).toBe(575);
  });

  it('crea la sesion con captura manual: el cliente solo autoriza y el cobro ocurre al registrar la compra', async () => {
    const { service, cliente } = crearService();

    const sesion = await service.crearSesion(datosSesion);

    expect(sesion).toEqual({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1', monto: 28.74 });
    expect(cliente.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        client_reference_id: 'C7-123',
        line_items: [expect.objectContaining({ quantity: 1, price_data: expect.objectContaining({ currency: 'usd', unit_amount: 2874 }) })],
        payment_intent_data: expect.objectContaining({ capture_method: 'manual' }),
        success_url: 'http://localhost:5173/checkout/stripe/retorno?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'http://localhost:5173/checkout/stripe/cancelado',
      }),
    );
  });

  it('agrega session_id a una URL de retorno que ya tiene parametros', async () => {
    const { service, cliente } = crearService();

    await service.crearSesion({ ...datosSesion, urlRetorno: 'http://localhost:5173/checkout/stripe/retorno?reserva=9' });

    expect(cliente.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ success_url: 'http://localhost:5173/checkout/stripe/retorno?reserva=9&session_id={CHECKOUT_SESSION_ID}' }),
    );
  });

  it('rechaza montos por debajo del minimo de Stripe sin llamarlo', async () => {
    const { service, cliente } = crearService();

    await expect(service.crearSesion({ ...datosSesion, montoBob: 2 })).rejects.toThrow(ServiceUnavailableException);
    expect(cliente.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('lee la sesion con el estado de su PaymentIntent', async () => {
    const { service, cliente } = crearService();

    await expect(service.obtenerSesion('cs_test_1')).resolves.toEqual({
      id: 'cs_test_1',
      status: 'complete',
      referencia: 'C7-123',
      moneda: 'usd',
      montoMinor: 2874,
      paymentIntentId: 'pi_1',
      paymentIntentStatus: 'requires_capture',
    });
    expect(cliente.checkout.sessions.retrieve).toHaveBeenCalledWith('cs_test_1', { expand: ['payment_intent'] });
  });

  it('captura con clave de idempotencia y exige que el cobro quede completado', async () => {
    const { service, cliente } = crearService();

    await expect(service.capturar('pi_1')).resolves.toEqual({ capturaId: 'pi_1' });
    expect(cliente.paymentIntents.capture).toHaveBeenCalledWith('pi_1', {}, { idempotencyKey: 'captura-pi_1' });

    cliente.paymentIntents.capture.mockResolvedValue({ id: 'pi_1', status: 'processing' });
    await expect(service.capturar('pi_1')).rejects.toThrow('no confirmo el cobro');
  });

  it('cancelar nunca lanza: si falla, la autorizacion vence sola', async () => {
    const { service, cliente } = crearService();
    cliente.paymentIntents.cancel.mockRejectedValue(new Error('ya capturado'));

    await expect(service.cancelar('pi_1')).resolves.toBeUndefined();
  });

  it('traduce los errores de Stripe a errores HTTP claros', async () => {
    const { service, cliente } = crearService();

    cliente.checkout.sessions.retrieve.mockRejectedValueOnce(new Stripe.errors.StripeConnectionError({ message: 'ECONNRESET' }));
    await expect(service.obtenerSesion('cs_test_1')).rejects.toThrow('No se pudo conectar con Stripe');

    cliente.checkout.sessions.retrieve.mockRejectedValueOnce(new Stripe.errors.StripeAuthenticationError({ message: 'Invalid API Key' }));
    await expect(service.obtenerSesion('cs_test_1')).rejects.toThrow(ServiceUnavailableException);

    cliente.checkout.sessions.retrieve.mockRejectedValueOnce(new Stripe.errors.StripeInvalidRequestError({ message: 'No such checkout.session' }));
    await expect(service.obtenerSesion('cs_test_1')).rejects.toThrow(BadGatewayException);
  });

  it('sin llave no esta configurado ni llama a Stripe', async () => {
    const { service } = crearService({ secretKey: '' });
    (service as unknown as { cliente: unknown }).cliente = null;

    expect(service.configurado).toBe(false);
    await expect(service.obtenerSesion('cs_test_1')).rejects.toThrow('Stripe no esta configurado');
  });
});
