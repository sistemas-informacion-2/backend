import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DevolucionesService } from './devoluciones.service.js';
import { Almacen } from '../../inventario/entities/almacen.entity.js';
import { Inventario } from '../../inventario/entities/inventario.entity.js';
import { NotificacionPush } from '../../electronico/entities/notificacion-push.entity.js';
import { Reserva } from '../../electronico/entities/reserva.entity.js';
import { EmpleadoSucursal } from '../../operaciones/entities/empleado-sucursal.entity.js';
import { Sucursal } from '../../operaciones/entities/sucursal.entity.js';
import { Caja } from '../entities/caja.entity.js';
import { DetalleNotaDevolucion } from '../entities/detalle-nota-devolucion.entity.js';
import { MovimientoCaja } from '../entities/movimiento-caja.entity.js';
import { NotaDevolucion } from '../entities/nota-devolucion.entity.js';
import { NotaVenta } from '../entities/nota-venta.entity.js';
import { Pago } from '../entities/pago.entity.js';
import { PasarelaPago } from '../entities/pasarela-pago.entity.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';

const admin: ActiveUser = { sub: 1, tipoUsuario: 'A', permisos: [], jti: 'x' };
const cajero: ActiveUser = { sub: 5, tipoUsuario: 'E', permisos: [], jti: 'x', sucursalId: 1 };

function hoy(): { fecha: string; hora: string } {
  const ahora = new Date();
  const fecha = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
  return { fecha, hora: ahora.toTimeString().slice(0, 8) };
}

function notaBase(overrides: Partial<NotaVenta> = {}): NotaVenta {
  const { fecha, hora } = hoy();
  return {
    id: 20,
    codigoNota: 'NV-000020',
    idCliente: 7,
    cliente: { usuario: { nombre: 'Ana', apellido: 'Perez' } } as never,
    idSucursal: 1,
    sucursal: { nombre: 'Central' } as never,
    tipoVenta: 'DIRECTA_PRESENCIAL',
    fechaEmision: fecha,
    horaEmision: hora,
    subtotal: 200,
    descuento: 20,
    impuesto: 0,
    montoTotal: 180,
    estadoPago: 'Pagado',
    detalles: [{ idVarianteProducto: 3, variante: { sku: 'SKU-3' }, descripcion: 'Polera (M/Negro)', cantidad: 2, subtotal: 200, precioUnitario: 100 }] as never,
    ...overrides,
  } as NotaVenta;
}

type RepoStub = Record<string, ReturnType<typeof vi.fn>>;

interface Escenario {
  nota?: NotaVenta | null;
  reserva?: Partial<Reserva> | null;
  anticipos?: number[];
  yaDevueltas?: Map<number, number>;
  yaReembolsado?: number;
  caja?: { id: number; idCajero: number | null } | null;
  inventario?: { stockDisponible: number; stockReservado: number } | null;
  visibles?: number[];
}

function crearService(escenario: Escenario = {}) {
  const guardados = { notificaciones: [] as Array<Record<string, unknown>>, pagos: [] as Array<Record<string, unknown>>, movimientos: [] as Array<Record<string, unknown>>, detalles: [] as Array<Record<string, unknown>>, notas: [] as Array<Record<string, unknown>> };
  const inventarioNuevo: Array<Record<string, unknown>> = [];
  const repos = new Map<unknown, RepoStub>();
  repos.set(Sucursal, { findOne: vi.fn().mockResolvedValue({ id: 1, activo: true }) });
  repos.set(NotaVenta, { findOne: vi.fn().mockResolvedValue(escenario.nota === undefined ? notaBase() : escenario.nota) });
  repos.set(Reserva, { findOne: vi.fn().mockResolvedValue(escenario.reserva ? { id: 30, codigoReserva: 'RS-000030', idCliente: 7, idSucursal: 1, estado: 'CANCELADA', fechaReserva: new Date(), ...escenario.reserva } : null) });
  repos.set(Pago, {
    find: vi.fn().mockResolvedValue((escenario.anticipos ?? []).map((monto) => ({ monto }))),
    create: vi.fn((d: Record<string, unknown>) => d),
    save: vi.fn(async (d: Record<string, unknown>) => {
      guardados.pagos.push(d);
      return d;
    }),
  });
  repos.set(Caja, { findOne: vi.fn().mockResolvedValue(escenario.caja === undefined ? { id: 9, idCajero: 5 } : escenario.caja) });
  repos.set(PasarelaPago, { findOne: vi.fn().mockResolvedValue({ id: 1, disponiblePresencial: true }) });
  repos.set(MovimientoCaja, {
    create: vi.fn((d: Record<string, unknown>) => d),
    save: vi.fn(async (d: Record<string, unknown>) => {
      guardados.movimientos.push(d);
      return { ...d, id: 55 };
    }),
  });
  repos.set(NotaDevolucion, {
    create: vi.fn((d: Record<string, unknown>) => d),
    save: vi.fn(async (d: Record<string, unknown>) => {
      guardados.notas.push({ ...d });
      return Object.assign(d, { id: 8 });
    }),
  });
  repos.set(DetalleNotaDevolucion, {
    create: vi.fn((d: Record<string, unknown>) => d),
    save: vi.fn(async (d: Array<Record<string, unknown>>) => {
      guardados.detalles.push(...d);
      return d;
    }),
  });
  repos.set(Almacen, { findOne: vi.fn().mockResolvedValue({ id: 2, nombre: 'Principal', activo: true, idSucursal: 1 }) });
  repos.set(Inventario, {
    findOne: vi.fn().mockResolvedValue(escenario.inventario === undefined ? { stockDisponible: 4, stockReservado: 0 } : escenario.inventario),
    create: vi.fn((d: Record<string, unknown>) => d),
    save: vi.fn(async (d: Record<string, unknown>) => {
      if (!escenario.inventario && escenario.inventario !== undefined) inventarioNuevo.push(d);
      return d;
    }),
  });
  repos.set(NotificacionPush, {
    create: vi.fn((d: Record<string, unknown>) => d),
    save: vi.fn(async (d: Record<string, unknown>) => {
      guardados.notificaciones.push(d);
      return d;
    }),
  });
  repos.set(EmpleadoSucursal, { findOne: vi.fn().mockResolvedValue({ idEmpleado: 5, idSucursal: 1, activo: true }) });

  const manager = {
    getRepository: (entidad: unknown) => {
      const repo = repos.get(entidad);
      if (!repo) throw new Error(`Repo no mockeado: ${(entidad as { name: string }).name}`);
      return repo;
    },
  };
  const dataSource = { transaction: vi.fn((cb: (m: unknown) => unknown) => cb(manager)), manager };
  const devolucionRepo = {
    unidadesDevueltasPorVariante: vi.fn().mockResolvedValue(escenario.yaDevueltas ?? new Map()),
    montoReembolsadoDeReserva: vi.fn().mockResolvedValue(escenario.yaReembolsado ?? 0),
    findByIdConDetalle: vi.fn().mockResolvedValue({ id: 8, idSucursal: 1, detalles: [], montoTotalReembolsado: 0 }),
    findPage: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  };
  const empleadoSucursalRepo = { find: vi.fn().mockResolvedValue((escenario.visibles ?? [1]).map((idSucursal) => ({ idSucursal }))) };
  const service = new DevolucionesService(devolucionRepo as never, dataSource as never, empleadoSucursalRepo as never);
  return { service, repos, guardados, inventarioNuevo, devolucionRepo };
}

const item = (cantidad: number, estadoProducto: 'REINGRESO_INVENTARIO' | 'MERMA_DEFECTUOSO', idAlmacen?: number) => ({
  idVarianteProducto: 3,
  cantidad,
  estadoProducto,
  idAlmacen,
});

describe('DevolucionesService', () => {
  describe('buscarOrigen', () => {
    it('calcula lo devuelto y prorratea el descuento de la nota en el precio', async () => {
      const { service } = crearService({ yaDevueltas: new Map([[3, 1]]) });

      const origen = await service.buscarOrigen({ codigoNota: 'nv-000020' });

      expect(origen.tipoDevolucion).toBe('PRODUCTO_ENTREGADO');
      expect(origen.dentroDePlazo).toBe(true);
      // 200 de subtotal, 180 pagados => 90 por unidad; comprada 2, devuelta 1 => queda 1.
      expect(origen.lineas[0]).toMatchObject({ precioReembolsable: 90, cantidadComprada: 2, cantidadDevuelta: 1, cantidadDisponible: 1 });
      expect(origen.montoReembolsable).toBe(90);
    });

    it('marca fuera de plazo una venta de hace mas de 30 dias', async () => {
      const { service } = crearService({ nota: notaBase({ fechaEmision: '2020-01-01' }) });

      expect((await service.buscarOrigen({ codigoNota: 'NV-000020' })).dentroDePlazo).toBe(false);
    });

    it('exige exactamente un codigo', async () => {
      const { service } = crearService();

      await expect(service.buscarOrigen({})).rejects.toThrow(BadRequestException);
      await expect(service.buscarOrigen({ codigoNota: 'NV-1', codigoReserva: 'RS-1' })).rejects.toThrow(BadRequestException);
    });

    it('rechaza una nota inexistente o sin pagar', async () => {
      await expect(crearService({ nota: null }).service.buscarOrigen({ codigoNota: 'NV-9' })).rejects.toThrow(NotFoundException);
      await expect(crearService({ nota: notaBase({ estadoPago: 'Pendiente' }) }).service.buscarOrigen({ codigoNota: 'NV-9' })).rejects.toThrow(
        'no esta pagada',
      );
    });

    it('solo acepta reservas canceladas', async () => {
      const { service } = crearService({ reserva: { estado: 'PAGADA' } });

      await expect(service.buscarOrigen({ codigoReserva: 'RS-000030' })).rejects.toThrow('cancelada');
    });
  });

  describe('crear de una nota de venta', () => {
    const base = { codigoNota: 'NV-000020', motivoDevolucion: 'TALLA_INCORRECTA' as const };

    it('reingresa la prenda al almacen y registra egreso de caja y pago REEMBOLSO', async () => {
      const inventario = { stockDisponible: 4, stockReservado: 0 };
      const { service, guardados } = crearService({ inventario });

      await service.crear({ ...base, items: [item(1, 'REINGRESO_INVENTARIO', 2)] }, cajero);

      expect(inventario.stockDisponible).toBe(5);
      expect(guardados.movimientos[0]).toMatchObject({ tipo: 'EGRESO', monto: '90.00', idCaja: 9 });
      expect(guardados.pagos[0]).toMatchObject({ concepto: 'REEMBOLSO', monto: 90, idNotaVenta: 20, idReserva: null, idMovimientoCaja: 55 });
      expect(guardados.notas[0]).toMatchObject({ idCajero: 5, tipoDevolucion: 'PRODUCTO_ENTREGADO', montoTotalReembolsado: 90 });
      expect(guardados.notas[1]).toMatchObject({ codigoDevolucion: 'DV-000008' });
    });

    it('la merma no incrementa el stock vendible', async () => {
      const inventario = { stockDisponible: 4, stockReservado: 0 };
      const { service, repos } = crearService({ inventario });

      await service.crear({ ...base, motivoDevolucion: 'FALLA_FABRICA', items: [item(1, 'MERMA_DEFECTUOSO')] }, cajero);

      expect(inventario.stockDisponible).toBe(4);
      expect(repos.get(Inventario)?.findOne).not.toHaveBeenCalled();
    });

    it('abre el registro de inventario si la variante no existia en el almacen', async () => {
      const { service, repos } = crearService({ inventario: null });

      await service.crear({ ...base, items: [item(2, 'REINGRESO_INVENTARIO', 2)] }, cajero);

      expect(repos.get(Inventario)?.create).toHaveBeenCalledWith(expect.objectContaining({ idAlmacen: 2, idVarianteProducto: 3, stockDisponible: 2 }));
    });

    it('no permite devolver mas de lo comprado, contando devoluciones previas', async () => {
      const { service } = crearService({ yaDevueltas: new Map([[3, 1]]) });

      await expect(service.crear({ ...base, items: [item(2, 'REINGRESO_INVENTARIO', 2)] }, cajero)).rejects.toThrow('Solo quedan 1');
    });

    it('suma las lineas repetidas antes de comparar con lo comprado', async () => {
      const { service } = crearService();

      await expect(
        service.crear({ ...base, items: [item(2, 'REINGRESO_INVENTARIO', 2), item(1, 'MERMA_DEFECTUOSO')] }, cajero),
      ).rejects.toThrow('Solo quedan 2');
    });

    it('rechaza una variante que no esta en la nota', async () => {
      const { service } = crearService();

      await expect(
        service.crear({ ...base, items: [{ idVarianteProducto: 99, cantidad: 1, estadoProducto: 'MERMA_DEFECTUOSO' }] }, cajero),
      ).rejects.toThrow('no forma parte');
    });

    it('exige almacen cuando la prenda vuelve al inventario y prendas seleccionadas', async () => {
      const { service } = crearService();

      await expect(service.crear({ ...base, items: [item(1, 'REINGRESO_INVENTARIO')] }, cajero)).rejects.toThrow('almacen');
      await expect(service.crear({ ...base }, cajero)).rejects.toThrow('al menos una prenda');
    });

    it('el almacen debe ser de la sucursal que recibe', async () => {
      const { service, repos } = crearService();
      repos.get(Almacen)?.findOne.mockResolvedValue({ id: 2, nombre: 'Otro', activo: true, idSucursal: 3 });

      await expect(service.crear({ ...base, items: [item(1, 'REINGRESO_INVENTARIO', 2)] }, cajero)).rejects.toThrow('no pertenece');
    });

    it('el motivo CANCELACION no aplica a una nota de venta', async () => {
      const { service } = crearService();

      await expect(service.crear({ ...base, motivoDevolucion: 'CANCELACION', items: [item(1, 'MERMA_DEFECTUOSO')] }, cajero)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('exige una caja abierta', async () => {
      const { service } = crearService({ caja: null });

      await expect(service.crear({ ...base, items: [item(1, 'MERMA_DEFECTUOSO')] }, cajero)).rejects.toThrow('caja abierta');
    });

    it('avisa al cliente cuando la compra fue e-commerce', async () => {
      const { service, guardados } = crearService({ nota: notaBase({ tipoVenta: 'E_COMMERCE' }) });

      await service.crear({ ...base, items: [item(1, 'MERMA_DEFECTUOSO')] }, cajero);

      expect(guardados.notificaciones[0]).toMatchObject({ idUsuario: 7, titulo: 'Reembolso registrado' });
    });

    it('no avisa cuando la venta fue presencial', async () => {
      const { service, guardados } = crearService();

      await service.crear({ ...base, items: [item(1, 'MERMA_DEFECTUOSO')] }, cajero);

      expect(guardados.notificaciones).toHaveLength(0);
    });
  });

  describe('plazo y autorizacion', () => {
    const vieja = () => notaBase({ fechaEmision: '2020-01-01' });
    const dto = { codigoNota: 'NV-000020', motivoDevolucion: 'ARREPENTIMIENTO' as const, items: [item(1, 'MERMA_DEFECTUOSO')] };

    it('un cajero no puede devolver fuera de plazo ni autorizarse', async () => {
      const { service } = crearService({ nota: vieja() });

      await expect(service.crear(dto, cajero)).rejects.toThrow('debe autorizar');
      await expect(service.crear({ ...dto, autorizarFueraDePlazo: true }, cajero)).rejects.toThrow(ForbiddenException);
    });

    it('el administrador autoriza indicando el cajero responsable', async () => {
      const { service, guardados } = crearService({ nota: vieja() });

      await service.crear({ ...dto, idSucursal: 1, idCajero: 5, autorizarFueraDePlazo: true }, admin);

      expect(guardados.notas[0]).toMatchObject({ idCajero: 5 });
    });

    it('el administrador debe indicar cajero si la caja no tiene uno', async () => {
      const { service } = crearService({ caja: { id: 9, idCajero: null } });

      await expect(service.crear({ ...dto, idSucursal: 1 }, admin)).rejects.toThrow('cajero responsable');
    });

    it('el cajero indicado debe estar asignado a la sucursal', async () => {
      const { service, repos } = crearService();
      repos.get(EmpleadoSucursal)?.findOne.mockResolvedValue(null);

      await expect(service.crear({ ...dto, idSucursal: 1, idCajero: 77 }, admin)).rejects.toThrow('no esta asignado');
    });

    it('el administrador debe indicar la sucursal', async () => {
      const { service } = crearService();

      await expect(service.crear(dto, admin)).rejects.toThrow('sucursal');
    });
  });

  describe('crear desde una reserva cancelada', () => {
    const base = { codigoReserva: 'RS-000030', motivoDevolucion: 'CANCELACION' as const };

    it('devuelve el anticipo cobrado como reembolso financiero sin tocar stock', async () => {
      const { service, guardados, repos } = crearService({ reserva: {}, anticipos: [30, 10] });

      await service.crear(base, cajero);

      expect(guardados.notas[0]).toMatchObject({ tipoDevolucion: 'CANCELACION_RESERVA', idReserva: 30, idNotaVenta: null, montoTotalReembolsado: 40 });
      expect(guardados.detalles[0]).toMatchObject({ estadoProducto: 'NO_APLICA', idVarianteProducto: null, idAlmacen: null, montoSubtotal: 40 });
      expect(guardados.pagos[0]).toMatchObject({ concepto: 'REEMBOLSO', idReserva: 30, idNotaVenta: null, monto: 40 });
      expect(repos.get(Inventario)?.findOne).not.toHaveBeenCalled();
    });

    it('descuenta lo ya reembolsado', async () => {
      const { service, guardados } = crearService({ reserva: {}, anticipos: [40], yaReembolsado: 15 });

      await service.crear(base, cajero);

      expect(guardados.notas[0]).toMatchObject({ montoTotalReembolsado: 25 });
    });

    it('rechaza cuando ya no queda anticipo por devolver', async () => {
      const { service } = crearService({ reserva: {}, anticipos: [40], yaReembolsado: 40 });

      await expect(service.crear(base, cajero)).rejects.toThrow('no tiene anticipo pendiente');
    });

    it('rechaza una reserva sin anticipo cobrado', async () => {
      const { service } = crearService({ reserva: {}, anticipos: [] });

      await expect(service.crear(base, cajero)).rejects.toThrow('no tiene anticipo pendiente');
    });

    it('el motivo debe ser CANCELACION', async () => {
      const { service } = crearService({ reserva: {}, anticipos: [40] });

      await expect(service.crear({ ...base, motivoDevolucion: 'ARREPENTIMIENTO' }, cajero)).rejects.toThrow('CANCELACION');
    });
  });

  describe('acceso por sucursal', () => {
    it('un empleado no lista devoluciones de sucursales ajenas', async () => {
      const { service } = crearService({ visibles: [1] });

      await expect(service.listar({ page: 1, limit: 10, idSucursal: 2 }, cajero)).rejects.toThrow(ForbiddenException);
    });

    it('un empleado sin sucursales asignadas ve una lista vacia', async () => {
      const { service, devolucionRepo } = crearService({ visibles: [] });

      const lista = await service.listar({ page: 1, limit: 10 }, cajero);

      expect(lista.items).toEqual([]);
      expect(devolucionRepo.findPage).not.toHaveBeenCalled();
    });

    it('un empleado no abre una devolucion de otra sucursal', async () => {
      const { service, devolucionRepo } = crearService({ visibles: [2] });
      devolucionRepo.findByIdConDetalle.mockResolvedValue({ id: 8, idSucursal: 1, detalles: [] });

      await expect(service.obtener(8, cajero)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('devoluciones propias del cliente', () => {
    const cliente: ActiveUser = { sub: 7, tipoUsuario: 'C', permisos: [], jti: 'x' };

    it('lista solo las del cliente del token', async () => {
      const { service, devolucionRepo } = crearService();

      await service.listarPropias({ page: 1, limit: 10 }, cliente);

      expect(devolucionRepo.findPage).toHaveBeenCalledWith({ page: 1, limit: 10, idCliente: 7 });
    });

    it('el personal no usa las rutas del cliente', async () => {
      const { service } = crearService();

      await expect(service.listarPropias({ page: 1, limit: 10 }, cajero)).rejects.toThrow(ForbiddenException);
      await expect(service.obtenerPropia(8, admin)).rejects.toThrow(ForbiddenException);
    });

    it('una devolucion ajena se ve como inexistente', async () => {
      const { service, devolucionRepo } = crearService();
      devolucionRepo.findByIdConDetalle.mockResolvedValue({ id: 8, idCliente: 99, detalles: [] });

      await expect(service.obtenerPropia(8, cliente)).rejects.toThrow(NotFoundException);
    });

    it('devuelve la devolucion propia', async () => {
      const { service, devolucionRepo } = crearService();
      devolucionRepo.findByIdConDetalle.mockResolvedValue({ id: 8, idCliente: 7, detalles: [], montoTotalReembolsado: 0 });

      await expect(service.obtenerPropia(8, cliente)).resolves.toMatchObject({ id: 8, idCliente: 7 });
    });
  });
});
