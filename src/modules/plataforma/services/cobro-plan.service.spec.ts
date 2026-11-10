import { ConflictException } from '@nestjs/common';
import { CobroPlanService } from './cobro-plan.service.js';

const plan = { id: 2, codigo: 'EMPRENDEDOR', nombre: 'Emprendedor', duracionDias: 30, precio: 149 };

function crear(estado: 'PENDIENTE' | 'PAGADO' | 'FALLIDO' = 'PENDIENTE') {
  const fila = { id: 7, tipo: 'ALTA', estado, monto: 149, idEmpresa: null, plan, detalleError: null as string | null };
  const repo = {
    findOne: vi.fn(async () => ({ ...fila })),
    save: vi.fn(async (valor: unknown) => valor),
    update: vi.fn(),
  };
  const dataSource = {
    getRepository: vi.fn(() => repo),
    transaction: vi.fn(async (callback: (manager: unknown) => unknown) => callback({ getRepository: () => repo })),
  };
  const stripe = {
    obtenerSesion: vi.fn(async () => ({
      id: 'cs_1',
      status: 'complete',
      referencia: 'PLAN-7',
      moneda: 'usd',
      montoMinor: 2141,
      paymentIntentId: 'pi_1',
      paymentIntentStatus: 'requires_capture',
    })),
    aMonedaStripe: vi.fn(() => 2141),
    capturar: vi.fn(async () => ({ capturaId: 'pi_1' })),
    cancelar: vi.fn(),
  };
  const service = new CobroPlanService(dataSource as never, stripe as never);
  return { service, repo, stripe, dataSource };
}

describe('CobroPlanService.confirmar', () => {
  it('aplica el pago y cobra como ultimo paso', async () => {
    const { service, stripe, repo } = crear();
    const orden: string[] = [];
    stripe.capturar.mockImplementation(async () => {
      orden.push('capturar');
      return { capturaId: 'pi_1' };
    });

    await service.confirmar('cs_1', () => true, async () => {
      orden.push('aplicar');
    });

    expect(orden).toEqual(['aplicar', 'capturar']);
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ estado: 'PAGADO', stripePaymentIntentId: 'pi_1' }));
    expect(stripe.cancelar).not.toHaveBeenCalled();
  });

  it('es idempotente: un pago ya confirmado no vuelve a Stripe ni se aplica otra vez', async () => {
    const { service, stripe } = crear('PAGADO');
    const aplicar = vi.fn();

    await service.confirmar('cs_1', () => true, aplicar);

    expect(aplicar).not.toHaveBeenCalled();
    expect(stripe.obtenerSesion).not.toHaveBeenCalled();
    expect(stripe.capturar).not.toHaveBeenCalled();
  });

  it('si no se puede aplicar, no cobra: libera la tarjeta y marca el pago como fallido', async () => {
    const { service, stripe, repo } = crear();

    await expect(
      service.confirmar('cs_1', () => true, async () => {
        throw new ConflictException('La dirección "moda" ya está en uso');
      }),
    ).rejects.toThrow(ConflictException);

    expect(stripe.capturar).not.toHaveBeenCalled();
    expect(stripe.cancelar).toHaveBeenCalledWith('pi_1');
    expect(repo.update).toHaveBeenCalledWith({ id: 7, estado: 'PENDIENTE' }, expect.objectContaining({ estado: 'FALLIDO' }));
  });

  it('rechaza una sesion de Stripe que no corresponde al cobro', async () => {
    const { service, stripe } = crear();
    stripe.obtenerSesion.mockResolvedValueOnce({ ...(await stripe.obtenerSesion()), referencia: 'PLAN-99' });

    await expect(service.confirmar('cs_1', () => true, vi.fn())).rejects.toThrow('no corresponde');
    expect(stripe.capturar).not.toHaveBeenCalled();
  });

  it('no confirma un pago de otro flujo (p. ej. de otra empresa)', async () => {
    const { service } = crear();

    await expect(service.confirmar('cs_1', () => false, vi.fn())).rejects.toThrow('No se encontró el pago');
  });
});
