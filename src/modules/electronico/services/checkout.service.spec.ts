import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CheckoutService, luhnValido } from './checkout.service.js';
import { DetalleNotaVenta } from '../../comercial/entities/detalle-nota-venta.entity.js';
import { NotaVenta } from '../../comercial/entities/nota-venta.entity.js';
import { Pago } from '../../comercial/entities/pago.entity.js';
import { Carrito } from '../entities/carrito.entity.js';
import { Reserva } from '../entities/reserva.entity.js';
import { DetalleCarrito } from '../entities/detalle-carrito.entity.js';
import { NotificacionPush } from '../entities/notificacion-push.entity.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';

const cliente: ActiveUser = { sub: 7, tipoUsuario: 'C', permisos: [], jti: 'x' };
const admin: ActiveUser = { sub: 1, tipoUsuario: 'A', permisos: [], jti: 'x' };

const TARJETA = { titular: 'Ana Perez', numero: '4111 1111 1111 1111', vencimiento: '12/99', cvv: '123' };

function carritoBase(cantidad = 2, precio = 100, descuento = 0, idSucursal = 2) {
  return {
    id: 4,
    idCliente: 7,
    idSucursal,
    detalles: [
      {
        idVarianteProducto: 3,
        cantidad,
        variante: { activo: true, talla: 'M', color: 'Negro', producto: { nombre: 'Polera', activo: true, precio, descuentoPorcentaje: descuento } },
      },
    ],
  };
}

function reservaBase(overrides: Record<string, unknown> = {}) {
  return { id: 9, codigoReserva: 'RS-000009', idCliente: 7, estado: 'PENDIENTE', montoAnticipo: 40, montoTotal: 200, fechaLimite: new Date(Date.now() + 3600_000), ...overrides };
}

/** Sesion de Stripe ya autorizada por el cliente 7 para su carrito de Bs 200 (= 2874 centavos de USD). */
function sesionStripe(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cs_test_1',
    status: 'complete',
    referencia: 'C7-123',
    moneda: 'usd',
    montoMinor: 2874,
    paymentIntentId: 'pi_1',
    paymentIntentStatus: 'requires_capture',
    ...overrides,
  };
}

interface Escenario {
  reserva?: ReturnType<typeof reservaBase> | null;
  carrito?: ReturnType<typeof carritoBase> | null;
  filasInventario?: Array<{ id: number; stock_disponible: number }>;
  simulados?: boolean;
  stripeConfigurado?: boolean;
  pasarelas?: Array<{ id: number; codigo: string; metodo: string; descripcion: string | null; disponibleLinea: boolean }>;
  pagoPrevio?: Record<string, unknown> | null;
  sesionStripe?: ReturnType<typeof sesionStripe>;
}

function crearService(escenario: Escenario = {}) {
  const orden: string[] = [];
  const consultas: Array<{ sql: string; params: unknown[] }> = [];
  const guardados = { pagos: [] as Array<Record<string, unknown>>, notas: [] as Array<Record<string, unknown>>, detalles: [] as Array<Record<string, unknown>>, notificaciones: [] as Array<Record<string, unknown>> };
  const pasarelas = escenario.pasarelas ?? [
    { id: 1, codigo: 'QR', metodo: 'QR', descripcion: null, disponibleLinea: true },
    { id: 2, codigo: 'TARJETA', metodo: 'Tarjeta', descripcion: null, disponibleLinea: true },
    { id: 3, codigo: 'STRIPE', metodo: 'Stripe', descripcion: 'Stripe', disponibleLinea: true },
    { id: 4, codigo: 'EFECTIVO', metodo: 'Efectivo', descripcion: null, disponibleLinea: true },
  ];

  const repos = new Map<unknown, Record<string, ReturnType<typeof vi.fn>>>();
  repos.set(Carrito, {
    findOne: vi.fn().mockResolvedValue(escenario.carrito === undefined ? carritoBase() : escenario.carrito),
    update: vi.fn(async () => {
      orden.push('carrito');
    }),
  });
  repos.set(Reserva, {
    findOne: vi.fn().mockResolvedValue(escenario.reserva === undefined ? null : escenario.reserva),
    save: vi.fn(async (d: Record<string, unknown>) => {
      orden.push('reserva');
      return d;
    }),
  });
  repos.set(DetalleCarrito, {
    delete: vi.fn(async () => {
      orden.push('vaciar');
    }),
  });
  repos.set(NotaVenta, {
    create: vi.fn((d: Record<string, unknown>) => d),
    save: vi.fn(async (d: Record<string, unknown>) => {
      guardados.notas.push({ ...d });
      return Object.assign(d, { id: 40 });
    }),
  });
  repos.set(DetalleNotaVenta, {
    create: vi.fn((d: Record<string, unknown>) => d),
    save: vi.fn(async (d: Array<Record<string, unknown>>) => {
      guardados.detalles.push(...d);
      return d;
    }),
  });
  repos.set(Pago, {
    create: vi.fn((d: Record<string, unknown>) => d),
    findOne: vi.fn().mockResolvedValue(escenario.pagoPrevio ?? null),
    save: vi.fn(async (d: Record<string, unknown>) => {
      orden.push('pago');
      guardados.pagos.push(d);
      return d;
    }),
  });
  repos.set(NotificacionPush, {
    create: vi.fn((d: Record<string, unknown>) => d),
    save: vi.fn(async (d: Record<string, unknown>) => {
      orden.push('notificacion');
      guardados.notificaciones.push(d);
      return d;
    }),
  });

  const manager = {
    getRepository: (entidad: unknown) => {
      const repo = repos.get(entidad);
      if (!repo) throw new Error(`Repo no mockeado: ${(entidad as { name: string }).name}`);
      return repo;
    },
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      consultas.push({ sql, params });
      if (sql.includes('SELECT')) return escenario.filasInventario ?? [{ id: 90, stock_disponible: 10 }];
      orden.push('descuento');
      return [];
    }),
  };
  const dataSource = {
    transaction: vi.fn((cb: (m: unknown) => unknown) => cb(manager)),
    manager,
    getRepository: (entidad: unknown) => repos.get(entidad),
  };
  const pasarelaRepo = {
    find: vi.fn().mockResolvedValue(pasarelas),
    findOne: vi.fn(async ({ where }: { where: { codigo: string } }) => pasarelas.find((p) => p.codigo === where.codigo && p.disponibleLinea) ?? null),
  };
  const stripe = {
    configurado: escenario.stripeConfigurado ?? true,
    moneda: 'usd',
    aMonedaStripe: (bob: number) => Math.round((bob / 6.96) * 100),
    crearSesion: vi.fn().mockResolvedValue({ id: 'cs_test_1', url: 'https://checkout.stripe.test/pagar', monto: 28.74 }),
    obtenerSesion: vi.fn().mockResolvedValue(escenario.sesionStripe ?? sesionStripe()),
    capturar: vi.fn(async () => {
      orden.push('capturar');
      return { capturaId: 'pi_1' };
    }),
    cancelar: vi.fn(async () => undefined),
  };
  const disponibilidad = { stockPorVariante: vi.fn().mockResolvedValue(new Map([[3, 10]])) };
  const cfg: Record<string, unknown> = { frontendUrl: 'http://localhost:5173', 'payments.simulated': escenario.simulados ?? true, 'jwt.secret': 'secreto-de-prueba' };
  const config = { get: (clave: string) => cfg[clave] };
  const notificaciones = { notificarPorPush: vi.fn() };
  const service = new CheckoutService(dataSource as never, pasarelaRepo as never, stripe as never, disponibilidad as never, config as never, notificaciones as never);
  return { service, stripe, guardados, orden, consultas, manager, repos, disponibilidad, notificaciones };
}

describe('luhnValido', () => {
  it('acepta tarjetas de prueba conocidas y rechaza digitos alterados', () => {
    expect(luhnValido('4111111111111111')).toBe(true);
    expect(luhnValido('4000000000000002')).toBe(true);
    expect(luhnValido('4111111111111112')).toBe(false);
  });
});

describe('CheckoutService', () => {
  describe('metodos', () => {
    it('ofrece QR, tarjeta y Stripe, y omite lo que este servidor no procesa', async () => {
      const { service } = crearService();

      const metodos = await service.metodos(cliente);

      expect(metodos.map((m) => m.codigo)).toEqual(['QR', 'TARJETA', 'STRIPE']);
      expect(metodos.find((m) => m.codigo === 'STRIPE')?.simulado).toBe(false);
      expect(metodos.find((m) => m.codigo === 'QR')?.simulado).toBe(true);
    });

    it('ya no ofrece PayPal aunque siga habilitado en la base', async () => {
      const { service } = crearService({
        pasarelas: [
          { id: 1, codigo: 'QR', metodo: 'QR', descripcion: null, disponibleLinea: true },
          { id: 5, codigo: 'PAYPAL', metodo: 'PayPal', descripcion: 'PayPal', disponibleLinea: true },
        ],
      });

      expect((await service.metodos(cliente)).map((m) => m.codigo)).toEqual(['QR']);
    });

    it('sin pagos simulados (produccion) oculta QR y tarjeta', async () => {
      const { service } = crearService({ simulados: false });

      expect((await service.metodos(cliente)).map((m) => m.codigo)).toEqual(['STRIPE']);
    });

    it('sin llave de Stripe lo oculta', async () => {
      const { service } = crearService({ stripeConfigurado: false });

      expect((await service.metodos(cliente)).map((m) => m.codigo)).toEqual(['QR', 'TARJETA']);
    });

    it('solo los clientes pagan', async () => {
      const { service } = crearService();

      await expect(service.metodos(admin)).rejects.toThrow(ForbiddenException);
      await expect(service.iniciarQr(admin)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('tarjeta (simulada)', () => {
    it('descuenta stock, registra venta y pago, vacia el carrito y avisa al cliente', async () => {
      const { service, guardados, consultas, repos } = crearService();

      const compra = await service.pagarTarjeta(cliente, TARJETA);

      expect(compra).toMatchObject({ idNotaVenta: 40, codigoNota: 'NV-000040', montoTotal: 200, metodo: 'Tarjeta' });
      expect(consultas.find((c) => c.sql.startsWith('UPDATE inventario'))?.params).toEqual([2, 90]);
      expect(guardados.notas[0]).toMatchObject({ tipoVenta: 'E_COMMERCE', tipo: 'ONLINE', idSucursal: 2, idCarrito: 4, idMovimientoCaja: null, estadoPago: 'Pagado', montoTotal: 200 });
      expect(guardados.pagos[0]).toMatchObject({ concepto: 'PAGO_TOTAL', monto: 200, idMovimientoCaja: null, idNotaVenta: 40 });
      expect(String(guardados.pagos[0].referenciaExterna)).toMatch(/^TARJETA:/);
      expect(repos.get(DetalleCarrito)?.delete).toHaveBeenCalledWith({ idCarrito: 4 });
      expect(guardados.notificaciones[0]).toMatchObject({ idUsuario: 7, titulo: 'Compra confirmada' });
    });

    it('cobra el precio vigente con el descuento del producto', async () => {
      const { service } = crearService({ carrito: carritoBase(2, 100, 30) });

      await expect(service.pagarTarjeta(cliente, TARJETA)).resolves.toMatchObject({ montoTotal: 140 });
    });

    it('rechaza numero invalido, tarjeta vencida y la tarjeta de prueba rechazada', async () => {
      const { service } = crearService();

      await expect(service.pagarTarjeta(cliente, { ...TARJETA, numero: '4111 1111 1111 1112' })).rejects.toThrow('no es valido');
      await expect(service.pagarTarjeta(cliente, { ...TARJETA, vencimiento: '01/20' })).rejects.toThrow('vencida');
      await expect(service.pagarTarjeta(cliente, { ...TARJETA, numero: '4000 0000 0000 0002' })).rejects.toThrow('rechazo');
    });

    it('no toca stock ni registra nada si la tarjeta es rechazada', async () => {
      const { service, guardados, consultas } = crearService();

      await expect(service.pagarTarjeta(cliente, { ...TARJETA, numero: '4000000000000002' })).rejects.toThrow();

      expect(consultas).toHaveLength(0);
      expect(guardados.pagos).toHaveLength(0);
    });

    it('rechaza un carrito vacio', async () => {
      const { service } = crearService({ carrito: null });

      await expect(service.pagarTarjeta(cliente, TARJETA)).rejects.toThrow('carrito esta vacio');
    });

    it('rechaza una variante que se desactivo', async () => {
      const carrito = carritoBase();
      carrito.detalles[0].variante.activo = false;
      const { service } = crearService({ carrito });

      await expect(service.pagarTarjeta(cliente, TARJETA)).rejects.toThrow('ya no esta disponible');
    });

    it('avisa cuando ya no alcanza el stock, sin registrar el pago', async () => {
      const { service, guardados } = crearService({ filasInventario: [{ id: 90, stock_disponible: 1 }] });

      await expect(service.pagarTarjeta(cliente, TARJETA)).rejects.toThrow('Ya no hay stock suficiente');
      expect(guardados.pagos).toHaveLength(0);
    });

    it('descuenta de varios almacenes de la MISMA sucursal si hace falta, pero nunca de otra sucursal', async () => {
      // Dos almacenes de la sucursal 2 (la del carrito): se reparte entre ellos, no con otra sucursal.
      const filas = [
        { id: 90, stock_disponible: 1 },
        { id: 91, stock_disponible: 4 },
      ];
      const { service, guardados, consultas } = crearService({ carrito: carritoBase(2, 100, 0, 2), filasInventario: filas });

      await service.pagarTarjeta(cliente, TARJETA);

      const consultaStock = consultas.find((c) => c.sql.includes('FOR UPDATE'));
      expect(consultaStock?.params).toEqual([3, 2]); // idVarianteProducto, idSucursal — nunca ranking entre sucursales.
      expect(consultas.filter((c) => c.sql.startsWith('UPDATE')).map((c) => c.params)).toEqual([[1, 90], [1, 91]]);
      expect(guardados.notas[0]).toMatchObject({ idSucursal: 2 });
    });

    it('no cobra ni descuenta de otra sucursal si la del carrito no tiene stock suficiente', async () => {
      const { service, guardados, consultas } = crearService({
        carrito: carritoBase(2, 100, 0, 2),
        filasInventario: [{ id: 90, stock_disponible: 1 }],
      });

      await expect(service.pagarTarjeta(cliente, TARJETA)).rejects.toThrow('Ya no hay stock suficiente');
      expect(guardados.pagos).toHaveLength(0);
      expect(consultas.filter((c) => c.sql.startsWith('UPDATE'))).toHaveLength(1); // solo el almacen que sí tenía algo, no salta a otra sucursal.
    });
  });

  describe('QR (simulado)', () => {
    it('genera un QR firmado con el total y lo confirma una sola vez', async () => {
      const { service, guardados } = crearService();

      const qr = await service.iniciarQr(cliente);
      const compra = await service.confirmarQr(cliente, qr.referencia);

      expect(qr.montoBob).toBe(200);
      expect(compra).toMatchObject({ codigoNota: 'NV-000040', metodo: 'QR' });
      expect(String(guardados.pagos[0].referenciaExterna)).toMatch(/^QR:/);
    });

    it('rechaza un QR alterado, ajeno o vencido', async () => {
      const { service } = crearService();
      const { referencia } = await service.iniciarQr(cliente);

      await expect(service.confirmarQr(cliente, `${referencia.slice(0, -2)}xx`)).rejects.toThrow(BadRequestException);
      await expect(service.confirmarQr({ ...cliente, sub: 99 }, referencia)).rejects.toThrow('no es valido');

      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 16 * 60 * 1000);
      await expect(service.confirmarQr(cliente, referencia)).rejects.toThrow('vencio');
      vi.useRealTimers();
    });

    it('si el carrito cambio despues de generar el QR, no cobra', async () => {
      const { service, repos } = crearService();
      const { referencia } = await service.iniciarQr(cliente);
      repos.get(Carrito)?.findOne.mockResolvedValue(carritoBase(3));

      await expect(service.confirmarQr(cliente, referencia)).rejects.toThrow('cambio');
    });

    it('devuelve la compra ya registrada si se confirma dos veces', async () => {
      const { service, guardados } = crearService();
      const { referencia } = await service.iniciarQr(cliente);
      const { repos } = { repos: (service as unknown as { dataSource: { getRepository: (e: unknown) => { findOne: ReturnType<typeof vi.fn> } } }).dataSource };
      repos.getRepository(Pago).findOne.mockResolvedValue({
        notaVenta: { id: 40, idCliente: 7, codigoNota: 'NV-000040', montoTotal: 200 },
        pasarela: { metodo: 'QR' },
      });

      await expect(service.confirmarQr(cliente, referencia)).resolves.toMatchObject({ idNotaVenta: 40, metodo: 'QR' });
      expect(guardados.pagos).toHaveLength(0);
    });

    it('avisa antes de generar el QR si ya no hay stock', async () => {
      const { service, disponibilidad } = crearService();
      disponibilidad.stockPorVariante.mockResolvedValue(new Map([[3, 1]]));

      await expect(service.iniciarQr(cliente)).rejects.toThrow('Solo quedan 1');
    });
  });

  describe('Stripe', () => {
    it('crea la sesion por el total del carrito con las URL de retorno del frontend', async () => {
      const { service, stripe } = crearService();

      const sesion = await service.iniciarStripe(cliente);

      expect(sesion).toMatchObject({ sessionId: 'cs_test_1', urlPago: 'https://checkout.stripe.test/pagar', montoBob: 200, montoCobrado: 28.74, monedaCobro: 'USD' });
      expect(stripe.crearSesion).toHaveBeenCalledWith(
        expect.objectContaining({
          montoBob: 200,
          referencia: expect.stringMatching(/^C7-\d+$/),
          urlRetorno: 'http://localhost:5173/checkout/stripe/retorno',
          urlCancelado: 'http://localhost:5173/checkout/stripe/cancelado',
        }),
      );
    });

    it('cobra en Stripe al final de la transaccion, despues de descontar stock y registrar el pago', async () => {
      const { service, stripe, orden, guardados } = crearService();

      const compra = await service.confirmarStripe(cliente, 'cs_test_1');

      expect(compra).toMatchObject({ codigoNota: 'NV-000040', metodo: 'Stripe' });
      expect(guardados.pagos[0]).toMatchObject({ referenciaExterna: 'STRIPE:cs_test_1', monto: 200 });
      expect(stripe.capturar).toHaveBeenCalledWith('pi_1');
      expect(orden.indexOf('capturar')).toBe(orden.length - 1);
      expect(orden.indexOf('descuento')).toBeLessThan(orden.indexOf('pago'));
      expect(orden.indexOf('pago')).toBeLessThan(orden.indexOf('capturar'));
      expect(stripe.cancelar).not.toHaveBeenCalled();
    });

    it('si Stripe falla al cobrar, la operacion falla y se libera la autorizacion', async () => {
      const { service, stripe } = crearService();
      stripe.capturar.mockRejectedValue(new Error('Stripe rechazo'));

      await expect(service.confirmarStripe(cliente, 'cs_test_1')).rejects.toThrow('Stripe rechazo');
      expect(stripe.cancelar).toHaveBeenCalledWith('pi_1');
    });

    it('no cobra una sesion de otro cliente', async () => {
      const { service, stripe } = crearService({ sesionStripe: sesionStripe({ referencia: 'C99-123' }) });

      await expect(service.confirmarStripe(cliente, 'cs_test_1')).rejects.toThrow(NotFoundException);
      expect(stripe.capturar).not.toHaveBeenCalled();
      expect(stripe.cancelar).not.toHaveBeenCalled();
    });

    it('no cobra una sesion que el cliente aun no autorizo', async () => {
      // Asi la devuelve Stripe mientras esta abierta: todavia sin PaymentIntent.
      const { service, stripe } = crearService({ sesionStripe: sesionStripe({ status: 'open', paymentIntentId: null, paymentIntentStatus: null }) });

      await expect(service.confirmarStripe(cliente, 'cs_test_1')).rejects.toThrow('todavia no confirma');
      expect(stripe.capturar).not.toHaveBeenCalled();
    });

    it('avisa si el pago ya fue cobrado', async () => {
      const { service, stripe } = crearService({ sesionStripe: sesionStripe({ paymentIntentStatus: 'succeeded' }) });

      await expect(service.confirmarStripe(cliente, 'cs_test_1')).rejects.toThrow('ya fue procesado');
      expect(stripe.capturar).not.toHaveBeenCalled();
    });

    it('si el carrito cambio despues de crear la sesion, no cobra y libera la autorizacion', async () => {
      const { service, stripe } = crearService({ sesionStripe: sesionStripe({ montoMinor: 1000 }) });

      await expect(service.confirmarStripe(cliente, 'cs_test_1')).rejects.toThrow('cambio');
      expect(stripe.capturar).not.toHaveBeenCalled();
      expect(stripe.cancelar).toHaveBeenCalledWith('pi_1');
    });

    it('si ya no hay stock al volver, no cobra y libera la autorizacion', async () => {
      const { service, stripe } = crearService({ filasInventario: [] });

      await expect(service.confirmarStripe(cliente, 'cs_test_1')).rejects.toThrow('stock');
      expect(stripe.capturar).not.toHaveBeenCalled();
      expect(stripe.cancelar).toHaveBeenCalledWith('pi_1');
    });

    it('recargar la pagina de retorno devuelve la compra ya registrada sin cobrar de nuevo', async () => {
      const { service, stripe } = crearService({
        pagoPrevio: { notaVenta: { id: 40, idCliente: 7, codigoNota: 'NV-000040', montoTotal: 200 }, pasarela: { metodo: 'Stripe' } },
      });

      await expect(service.confirmarStripe(cliente, 'cs_test_1')).resolves.toMatchObject({ idNotaVenta: 40 });
      expect(stripe.obtenerSesion).not.toHaveBeenCalled();
      expect(stripe.capturar).not.toHaveBeenCalled();
    });

    it('sin llave de Stripe no crea sesiones', async () => {
      const { service } = crearService({ stripeConfigurado: false });

      await expect(service.iniciarStripe(cliente)).rejects.toThrow(ConflictException);
    });
  });

  describe('anticipo de una reserva', () => {
    it('cobra el anticipo sin caja, deja la reserva PAGADA y no toca stock ni carrito', async () => {
      const reserva = reservaBase();
      const { service, guardados, consultas, repos } = crearService({ reserva });

      const resultado = await service.pagarTarjeta(cliente, TARJETA, 9);

      expect(resultado).toMatchObject({ tipo: 'ANTICIPO_RESERVA', idReserva: 9, codigoReserva: 'RS-000009', idNotaVenta: null, montoTotal: 40, metodo: 'Tarjeta' });
      expect(guardados.pagos[0]).toMatchObject({ concepto: 'ANTICIPO_RESERVA', monto: 40, idReserva: 9, idNotaVenta: null, idMovimientoCaja: null });
      expect(reserva.estado).toBe('PAGADA');
      expect(guardados.notificaciones[0]).toMatchObject({ idUsuario: 7, titulo: 'Reserva confirmada' });
      expect(consultas).toHaveLength(0);
      expect(repos.get(DetalleCarrito)?.delete).not.toHaveBeenCalled();
    });

    it('con Stripe crea la sesion por el anticipo y vuelve a la pagina de retorno de esa reserva', async () => {
      const { service, stripe } = crearService({ reserva: reservaBase() });

      const sesion = await service.iniciarStripe(cliente, 9);

      expect(sesion.montoBob).toBe(40);
      expect(stripe.crearSesion).toHaveBeenCalledWith(
        expect.objectContaining({
          montoBob: 40,
          referencia: expect.stringMatching(/^R7-9-\d+$/),
          urlRetorno: 'http://localhost:5173/checkout/stripe/retorno?reserva=9',
          urlCancelado: 'http://localhost:5173/checkout/stripe/cancelado?reserva=9',
        }),
      );
    });

    it('cobra en Stripe al final, despues de registrar el pago y confirmar la reserva', async () => {
      const { service, orden } = crearService({
        reserva: reservaBase(),
        sesionStripe: sesionStripe({ referencia: 'R7-9-123', montoMinor: 575 }),
      });

      await expect(service.confirmarStripe(cliente, 'cs_test_1', 9)).resolves.toMatchObject({ tipo: 'ANTICIPO_RESERVA', codigoReserva: 'RS-000009' });

      expect(orden.indexOf('pago')).toBeLessThan(orden.indexOf('reserva'));
      expect(orden.indexOf('capturar')).toBe(orden.length - 1);
    });

    it('no cobra una sesion creada para el carrito ni para otra reserva', async () => {
      const carritoSesion = crearService({ reserva: reservaBase() });
      await expect(carritoSesion.service.confirmarStripe(cliente, 'cs_test_1', 9)).rejects.toThrow(NotFoundException);
      expect(carritoSesion.stripe.capturar).not.toHaveBeenCalled();

      const otra = crearService({
        reserva: reservaBase(),
        sesionStripe: sesionStripe({ referencia: 'R7-10-123', montoMinor: 575 }),
      });
      await expect(otra.service.confirmarStripe(cliente, 'cs_test_1', 9)).rejects.toThrow(NotFoundException);
    });

    it('no cobra si el monto de la sesion no es el del anticipo', async () => {
      const { service, stripe } = crearService({
        reserva: reservaBase(),
        sesionStripe: sesionStripe({ referencia: 'R7-9-123', montoMinor: 9900 }),
      });

      await expect(service.confirmarStripe(cliente, 'cs_test_1', 9)).rejects.toThrow('cambio');
      expect(stripe.capturar).not.toHaveBeenCalled();
      expect(stripe.cancelar).toHaveBeenCalledWith('pi_1');
    });

    it('una reserva ajena o inexistente responde no encontrada', async () => {
      await expect(crearService({ reserva: reservaBase({ idCliente: 99 }) }).service.pagarTarjeta(cliente, TARJETA, 9)).rejects.toThrow(NotFoundException);
      await expect(crearService({ reserva: null }).service.iniciarQr(cliente, 9)).rejects.toThrow(NotFoundException);
    });

    it('rechaza pagar una reserva ya pagada, cancelada o vencida', async () => {
      await expect(crearService({ reserva: reservaBase({ estado: 'PAGADA' }) }).service.pagarTarjeta(cliente, TARJETA, 9)).rejects.toThrow('ya esta pagado');
      await expect(crearService({ reserva: reservaBase({ estado: 'CANCELADA' }) }).service.pagarTarjeta(cliente, TARJETA, 9)).rejects.toThrow('cancelada');
      await expect(crearService({ reserva: reservaBase({ fechaLimite: new Date(Date.now() - 1000) }) }).service.pagarTarjeta(cliente, TARJETA, 9)).rejects.toThrow('vencio');
    });

    it('el QR de una reserva no sirve para el carrito ni para otra reserva, y al reves', async () => {
      const { service } = crearService({ reserva: reservaBase() });
      const qrReserva = await service.iniciarQr(cliente, 9);
      const qrCarrito = await service.iniciarQr(cliente);

      expect(qrReserva.montoBob).toBe(40);
      await expect(service.confirmarQr(cliente, qrReserva.referencia)).rejects.toThrow('no es valido');
      await expect(service.confirmarQr(cliente, qrReserva.referencia, 10)).rejects.toThrow('no es valido');
      await expect(service.confirmarQr(cliente, qrCarrito.referencia, 9)).rejects.toThrow('no es valido');
      await expect(service.confirmarQr(cliente, qrReserva.referencia, 9)).resolves.toMatchObject({ tipo: 'ANTICIPO_RESERVA', montoTotal: 40 });
    });

    it('un cobro repetido devuelve el anticipo ya registrado sin cobrar de nuevo', async () => {
      const { service, stripe } = crearService({
        reserva: reservaBase(),
        pagoPrevio: { monto: 40, reserva: { id: 9, idCliente: 7, codigoReserva: 'RS-000009' }, notaVenta: null, pasarela: { metodo: 'Stripe' } },
      });

      await expect(service.confirmarStripe(cliente, 'cs_test_1', 9)).resolves.toMatchObject({ tipo: 'ANTICIPO_RESERVA', idReserva: 9, montoTotal: 40 });
      expect(stripe.capturar).not.toHaveBeenCalled();
    });
  });

  describe('push de compra confirmada', () => {
    it('una compra nueva avisa por push con la notificacion guardada', async () => {
      const { service, notificaciones } = crearService();

      await service.pagarTarjeta(cliente, TARJETA);

      expect(notificaciones.notificarPorPush).toHaveBeenCalledTimes(1);
      expect(notificaciones.notificarPorPush).toHaveBeenCalledWith([
        expect.objectContaining({ idUsuario: 7, titulo: 'Compra confirmada' }),
      ]);
    });

    it('con Stripe el push sale despues de cobrar, fuera de la transaccion', async () => {
      const { service, stripe, notificaciones } = crearService();

      await service.confirmarStripe(cliente, 'cs_test_1');

      expect(notificaciones.notificarPorPush).toHaveBeenCalledTimes(1);
      expect(stripe.capturar.mock.invocationCallOrder[0]).toBeLessThan(notificaciones.notificarPorPush.mock.invocationCallOrder[0]);
    });

    it('si Stripe no cobra, no hay push', async () => {
      const { service, stripe, notificaciones } = crearService();
      stripe.capturar.mockRejectedValue(new Error('Stripe rechazo'));

      await expect(service.confirmarStripe(cliente, 'cs_test_1')).rejects.toThrow('Stripe rechazo');

      expect(notificaciones.notificarPorPush).not.toHaveBeenCalled();
    });

    it('confirmar dos veces el mismo QR no repite el push', async () => {
      const { service, notificaciones } = crearService();
      const { referencia } = await service.iniciarQr(cliente);
      const { repos } = { repos: (service as unknown as { dataSource: { getRepository: (e: unknown) => { findOne: ReturnType<typeof vi.fn> } } }).dataSource };
      repos.getRepository(Pago).findOne.mockResolvedValue({
        notaVenta: { id: 40, idCliente: 7, codigoNota: 'NV-000040', montoTotal: 200 },
        pasarela: { metodo: 'QR' },
      });

      await service.confirmarQr(cliente, referencia);

      expect(notificaciones.notificarPorPush).not.toHaveBeenCalled();
    });

    it('pagar el anticipo de una reserva no envia push', async () => {
      const { service, notificaciones } = crearService({ reserva: reservaBase() });

      await service.pagarTarjeta(cliente, TARJETA, 9);

      expect(notificaciones.notificarPorPush).not.toHaveBeenCalled();
    });
  });
});
