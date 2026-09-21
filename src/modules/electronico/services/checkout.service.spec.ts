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

function carritoBase(cantidad = 2, precio = 100, descuento = 0) {
  return {
    id: 4,
    idCliente: 7,
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

interface Escenario {
  reserva?: ReturnType<typeof reservaBase> | null;
  carrito?: ReturnType<typeof carritoBase> | null;
  filasInventario?: Array<{ id: number; id_sucursal: number; stock_disponible: number }>;
  simulados?: boolean;
  paypalConfigurado?: boolean;
  pasarelas?: Array<{ id: number; codigo: string; metodo: string; descripcion: string | null; disponibleLinea: boolean }>;
  pagoPrevio?: Record<string, unknown> | null;
  ordenPaypal?: { id: string; status: string; referenceId: string; moneda: string; monto: string };
}

function crearService(escenario: Escenario = {}) {
  const orden: string[] = [];
  const consultas: Array<{ sql: string; params: unknown[] }> = [];
  const guardados = { pagos: [] as Array<Record<string, unknown>>, notas: [] as Array<Record<string, unknown>>, detalles: [] as Array<Record<string, unknown>>, notificaciones: [] as Array<Record<string, unknown>> };
  const pasarelas = escenario.pasarelas ?? [
    { id: 1, codigo: 'QR', metodo: 'QR', descripcion: null, disponibleLinea: true },
    { id: 2, codigo: 'TARJETA', metodo: 'Tarjeta', descripcion: null, disponibleLinea: true },
    { id: 3, codigo: 'PAYPAL', metodo: 'PayPal', descripcion: 'PayPal', disponibleLinea: true },
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
      if (sql.includes('SELECT')) return escenario.filasInventario ?? [{ id: 90, id_sucursal: 2, stock_disponible: 10 }];
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
  const paypal = {
    configurado: escenario.paypalConfigurado ?? true,
    moneda: 'USD',
    aMonedaPaypal: (bob: number) => Math.round((bob / 6.96 + Number.EPSILON) * 100) / 100,
    crearOrden: vi.fn().mockResolvedValue({ id: 'ORD-1', urlAprobacion: 'https://paypal.test/aprobar', monto: 28.74 }),
    obtenerOrden: vi.fn().mockResolvedValue(escenario.ordenPaypal ?? { id: 'ORD-1', status: 'APPROVED', referenceId: 'C7-123', moneda: 'USD', monto: '28.74' }),
    capturar: vi.fn(async () => {
      orden.push('capturar');
      return { capturaId: 'CAP-1' };
    }),
  };
  const disponibilidad = { stockPorVariante: vi.fn().mockResolvedValue(new Map([[3, 10]])) };
  const cfg: Record<string, unknown> = { frontendUrl: 'http://localhost:5173', 'payments.simulated': escenario.simulados ?? true, 'jwt.secret': 'secreto-de-prueba' };
  const config = { get: (clave: string) => cfg[clave] };
  const service = new CheckoutService(dataSource as never, pasarelaRepo as never, paypal as never, disponibilidad as never, config as never);
  return { service, paypal, guardados, orden, consultas, manager, repos, disponibilidad };
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
    it('ofrece QR, tarjeta y PayPal, y omite lo que este servidor no procesa', async () => {
      const { service } = crearService();

      const metodos = await service.metodos(cliente);

      expect(metodos.map((m) => m.codigo)).toEqual(['QR', 'TARJETA', 'PAYPAL']);
      expect(metodos.find((m) => m.codigo === 'PAYPAL')?.simulado).toBe(false);
      expect(metodos.find((m) => m.codigo === 'QR')?.simulado).toBe(true);
    });

    it('sin pagos simulados (produccion) oculta QR y tarjeta', async () => {
      const { service } = crearService({ simulados: false });

      expect((await service.metodos(cliente)).map((m) => m.codigo)).toEqual(['PAYPAL']);
    });

    it('sin credenciales de PayPal lo oculta', async () => {
      const { service } = crearService({ paypalConfigurado: false });

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
      const { service, guardados } = crearService({ filasInventario: [{ id: 90, id_sucursal: 2, stock_disponible: 1 }] });

      await expect(service.pagarTarjeta(cliente, TARJETA)).rejects.toThrow('Ya no hay stock suficiente');
      expect(guardados.pagos).toHaveLength(0);
    });

    it('reparte el descuento entre almacenes y asigna la venta a la sucursal que mas aporta', async () => {
      const filas = [
        { id: 90, id_sucursal: 2, stock_disponible: 1 },
        { id: 91, id_sucursal: 5, stock_disponible: 4 },
      ];
      const { service, guardados, consultas } = crearService({ filasInventario: [filas[1], filas[0]] });

      await service.pagarTarjeta(cliente, TARJETA);

      expect(consultas.filter((c) => c.sql.startsWith('UPDATE')).map((c) => c.params)).toEqual([[2, 91]]);
      expect(guardados.notas[0]).toMatchObject({ idSucursal: 5 });
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

  describe('PayPal', () => {
    it('crea la orden por el total del carrito con las URL de retorno del frontend', async () => {
      const { service, paypal } = crearService();

      const orden = await service.iniciarPaypal(cliente);

      expect(orden).toMatchObject({ orderId: 'ORD-1', urlAprobacion: 'https://paypal.test/aprobar', montoBob: 200, montoPaypal: 28.74, monedaPaypal: 'USD' });
      expect(paypal.crearOrden).toHaveBeenCalledWith(
        expect.objectContaining({ montoBob: 200, urlRetorno: 'http://localhost:5173/checkout/paypal/retorno', urlCancelado: 'http://localhost:5173/checkout/paypal/cancelado' }),
      );
    });

    it('cobra en PayPal al final de la transaccion, despues de descontar stock y registrar el pago', async () => {
      const { service, orden } = crearService();

      const compra = await service.capturarPaypal(cliente, 'ORD-1');

      expect(compra).toMatchObject({ codigoNota: 'NV-000040', metodo: 'PayPal' });
      expect(orden.indexOf('capturar')).toBe(orden.length - 1);
      expect(orden.indexOf('descuento')).toBeLessThan(orden.indexOf('pago'));
      expect(orden.indexOf('pago')).toBeLessThan(orden.indexOf('capturar'));
    });

    it('si PayPal falla al cobrar, la operacion falla y no queda venta confirmada', async () => {
      const { service, paypal } = crearService();
      paypal.capturar.mockRejectedValue(new Error('PayPal rechazo'));

      await expect(service.capturarPaypal(cliente, 'ORD-1')).rejects.toThrow('PayPal rechazo');
    });

    it('no cobra una orden de otro cliente', async () => {
      const { service, paypal } = crearService({ ordenPaypal: { id: 'ORD-1', status: 'APPROVED', referenceId: 'C99-123', moneda: 'USD', monto: '28.74' } });

      await expect(service.capturarPaypal(cliente, 'ORD-1')).rejects.toThrow(NotFoundException);
      expect(paypal.capturar).not.toHaveBeenCalled();
    });

    it('no cobra una orden que el cliente aun no aprobo', async () => {
      const { service, paypal } = crearService({ ordenPaypal: { id: 'ORD-1', status: 'PAYER_ACTION_REQUIRED', referenceId: 'C7-123', moneda: 'USD', monto: '28.74' } });

      await expect(service.capturarPaypal(cliente, 'ORD-1')).rejects.toThrow('todavia no confirma');
      expect(paypal.capturar).not.toHaveBeenCalled();
    });

    it('no cobra si el carrito cambio despues de crear la orden', async () => {
      const { service, paypal } = crearService({ ordenPaypal: { id: 'ORD-1', status: 'APPROVED', referenceId: 'C7-123', moneda: 'USD', monto: '10.00' } });

      await expect(service.capturarPaypal(cliente, 'ORD-1')).rejects.toThrow('cambio');
      expect(paypal.capturar).not.toHaveBeenCalled();
    });

    it('recargar la pagina de retorno devuelve la compra ya registrada sin cobrar de nuevo', async () => {
      const { service, paypal } = crearService({
        pagoPrevio: { notaVenta: { id: 40, idCliente: 7, codigoNota: 'NV-000040', montoTotal: 200 }, pasarela: { metodo: 'PayPal' } },
      });

      await expect(service.capturarPaypal(cliente, 'ORD-1')).resolves.toMatchObject({ idNotaVenta: 40 });
      expect(paypal.obtenerOrden).not.toHaveBeenCalled();
      expect(paypal.capturar).not.toHaveBeenCalled();
    });

    it('con PayPal deshabilitado no crea ordenes', async () => {
      const { service } = crearService({ paypalConfigurado: false });

      await expect(service.iniciarPaypal(cliente)).rejects.toThrow(ConflictException);
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

    it('con PayPal crea la orden por el anticipo y vuelve a la pagina de retorno de esa reserva', async () => {
      const { service, paypal } = crearService({ reserva: reservaBase() });

      const orden = await service.iniciarPaypal(cliente, 9);

      expect(orden.montoBob).toBe(40);
      expect(paypal.crearOrden).toHaveBeenCalledWith(
        expect.objectContaining({
          montoBob: 40,
          referencia: expect.stringMatching(/^R7-9-\d+$/),
          urlRetorno: 'http://localhost:5173/checkout/paypal/retorno?reserva=9',
          urlCancelado: 'http://localhost:5173/checkout/paypal/cancelado?reserva=9',
        }),
      );
    });

    it('cobra en PayPal al final, despues de registrar el pago y confirmar la reserva', async () => {
      const { service, orden } = crearService({
        reserva: reservaBase(),
        ordenPaypal: { id: 'ORD-1', status: 'APPROVED', referenceId: 'R7-9-123', moneda: 'USD', monto: '5.75' },
      });

      await expect(service.capturarPaypal(cliente, 'ORD-1', 9)).resolves.toMatchObject({ tipo: 'ANTICIPO_RESERVA', codigoReserva: 'RS-000009' });

      expect(orden.indexOf('pago')).toBeLessThan(orden.indexOf('reserva'));
      expect(orden.indexOf('capturar')).toBe(orden.length - 1);
    });

    it('no cobra una orden creada para el carrito ni para otra reserva', async () => {
      const carritoOrden = crearService({ reserva: reservaBase() });
      await expect(carritoOrden.service.capturarPaypal(cliente, 'ORD-1', 9)).rejects.toThrow(NotFoundException);
      expect(carritoOrden.paypal.capturar).not.toHaveBeenCalled();

      const otra = crearService({
        reserva: reservaBase(),
        ordenPaypal: { id: 'ORD-1', status: 'APPROVED', referenceId: 'R7-10-123', moneda: 'USD', monto: '5.75' },
      });
      await expect(otra.service.capturarPaypal(cliente, 'ORD-1', 9)).rejects.toThrow(NotFoundException);
    });

    it('no cobra si el monto de la orden no es el del anticipo', async () => {
      const { service, paypal } = crearService({
        reserva: reservaBase(),
        ordenPaypal: { id: 'ORD-1', status: 'APPROVED', referenceId: 'R7-9-123', moneda: 'USD', monto: '99.00' },
      });

      await expect(service.capturarPaypal(cliente, 'ORD-1', 9)).rejects.toThrow('cambio');
      expect(paypal.capturar).not.toHaveBeenCalled();
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
      const { service, paypal } = crearService({
        reserva: reservaBase(),
        pagoPrevio: { monto: 40, reserva: { id: 9, idCliente: 7, codigoReserva: 'RS-000009' }, notaVenta: null, pasarela: { metodo: 'PayPal' } },
      });

      await expect(service.capturarPaypal(cliente, 'ORD-1', 9)).resolves.toMatchObject({ tipo: 'ANTICIPO_RESERVA', idReserva: 9, montoTotal: 40 });
      expect(paypal.capturar).not.toHaveBeenCalled();
    });
  });

});
