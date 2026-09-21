import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReservasService } from './reservas.service.js';
import { Almacen } from '../../inventario/entities/almacen.entity.js';
import { Inventario } from '../../inventario/entities/inventario.entity.js';
import { ProductoSucursal } from '../../inventario/entities/producto-sucursal.entity.js';
import { VarianteProducto } from '../../inventario/entities/variante-producto.entity.js';
import { Caja } from '../../comercial/entities/caja.entity.js';
import { Pago } from '../../comercial/entities/pago.entity.js';
import { Cliente } from '../../operaciones/entities/cliente.entity.js';
import { Sucursal } from '../../operaciones/entities/sucursal.entity.js';
import { DetalleReserva } from '../entities/detalle-reserva.entity.js';
import { Reserva } from '../entities/reserva.entity.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';

const cliente: ActiveUser = { sub: 7, tipoUsuario: 'C', permisos: [], jti: 'x' };
const admin: ActiveUser = { sub: 1, tipoUsuario: 'A', permisos: [], jti: 'x' };
const empleado: ActiveUser = { sub: 5, tipoUsuario: 'E', permisos: [], jti: 'x', sucursalId: 1 };

function reservaBase(overrides: Partial<Reserva> = {}): Reserva {
  return {
    id: 10,
    codigoReserva: 'RS-000010',
    idCliente: 7,
    cliente: { usuario: { nombre: 'Ana', apellido: 'Perez' } } as never,
    idSucursal: 1,
    sucursal: { nombre: 'Central' } as never,
    fechaReserva: new Date(),
    fechaLimite: new Date(Date.now() + 3600_000),
    estado: 'PENDIENTE',
    montoAnticipo: 40,
    montoTotal: 200,
    observaciones: null,
    detalles: [],
    pagos: [],
    ...overrides,
  };
}

type RepoStub = Record<string, ReturnType<typeof vi.fn>>;

function crearService(config: { repos?: Map<unknown, RepoStub>; reserva?: Reserva | null; vencidas?: number[] } = {}) {
  const repos = config.repos ?? new Map<unknown, RepoStub>();
  const manager = {
    getRepository: (entidad: unknown) => {
      const repo = repos.get(entidad);
      if (!repo) throw new Error(`Repo no mockeado: ${(entidad as { name: string }).name}`);
      return repo;
    },
  };
  const dataSource = { transaction: vi.fn((cb: (m: unknown) => unknown) => cb(manager)) };
  const reservaRepo = {
    findByIdConDetalle: vi.fn().mockResolvedValue(config.reserva === undefined ? reservaBase() : config.reserva),
    findByCliente: vi.fn().mockResolvedValue([]),
    findPage: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findIdsVencidas: vi.fn().mockResolvedValue(config.vencidas ?? []),
    findNotaVenta: vi.fn().mockResolvedValue(null),
  };
  const empleadoSucursalRepo = { find: vi.fn().mockResolvedValue([{ idSucursal: 1 }]) };
  const service = new ReservasService(reservaRepo as never, dataSource as never, {} as never, empleadoSucursalRepo as never);
  return { service, repos, reservaRepo, dataSource, empleadoSucursalRepo };
}

/** Repos para el camino feliz de `crear`, con stock configurable. */
function reposParaCrear(inventario: { stockDisponible: number; stockReservado: number }, activas = 0) {
  const guardadas: Array<Record<string, unknown>> = [];
  const repos = new Map<unknown, RepoStub>();
  repos.set(Cliente, { findOne: vi.fn().mockResolvedValue({ idUsuario: 7 }) });
  repos.set(Sucursal, { findOne: vi.fn().mockResolvedValue({ id: 1, activo: true }) });
  repos.set(Reserva, {
    count: vi.fn().mockResolvedValue(activas),
    create: vi.fn((datos: Record<string, unknown>) => ({ ...datos })),
    save: vi.fn(async (datos: Record<string, unknown>) => {
      guardadas.push(datos);
      return Object.assign(datos, { id: 10 });
    }),
  });
  repos.set(VarianteProducto, {
    find: vi.fn().mockResolvedValue([
      {
        id: 3,
        idProducto: 9,
        sku: 'SKU-3',
        talla: 'M',
        color: 'Negro',
        activo: true,
        producto: { nombre: 'Polera', activo: true, precio: 100, descuentoPorcentaje: 0 },
      },
    ]),
  });
  repos.set(ProductoSucursal, { find: vi.fn().mockResolvedValue([{ idProducto: 9 }]) });
  repos.set(Almacen, { find: vi.fn().mockResolvedValue([{ id: 1 }]) });
  repos.set(Inventario, {
    find: vi.fn().mockResolvedValue([inventario]),
    save: vi.fn(async (fila: unknown) => fila),
  });
  repos.set(DetalleReserva, { create: vi.fn((d: unknown) => d), save: vi.fn() });
  return { repos, guardadas };
}

describe('ReservasService', () => {
  describe('crear', () => {
    it('aparta el stock y fija el anticipo minimo del 20%', async () => {
      const inventario = { stockDisponible: 5, stockReservado: 0 };
      const { repos, guardadas } = reposParaCrear(inventario);
      const { service } = crearService({ repos });

      await service.crear({ idSucursal: 1, items: [{ idVarianteProducto: 3, cantidad: 2 }] }, cliente);

      expect(inventario).toEqual({ stockDisponible: 3, stockReservado: 2 });
      expect(guardadas[0]).toMatchObject({ idCliente: 7, estado: 'PENDIENTE', montoTotal: 200, montoAnticipo: 40 });
      expect(guardadas[1]).toMatchObject({ codigoReserva: 'RS-000010' });
    });

    it('suma las lineas repetidas de una misma variante', async () => {
      const inventario = { stockDisponible: 5, stockReservado: 0 };
      const { repos } = reposParaCrear(inventario);
      const { service } = crearService({ repos });

      await service.crear(
        {
          idSucursal: 1,
          items: [
            { idVarianteProducto: 3, cantidad: 1 },
            { idVarianteProducto: 3, cantidad: 2 },
          ],
        },
        cliente,
      );

      expect(inventario).toEqual({ stockDisponible: 2, stockReservado: 3 });
    });

    it('rechaza un anticipo menor al minimo', async () => {
      const { repos } = reposParaCrear({ stockDisponible: 5, stockReservado: 0 });
      const { service } = crearService({ repos });

      await expect(
        service.crear({ idSucursal: 1, montoAnticipo: 10, items: [{ idVarianteProducto: 3, cantidad: 2 }] }, cliente),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza un anticipo mayor al total', async () => {
      const { repos } = reposParaCrear({ stockDisponible: 5, stockReservado: 0 });
      const { service } = crearService({ repos });

      await expect(
        service.crear({ idSucursal: 1, montoAnticipo: 500, items: [{ idVarianteProducto: 3, cantidad: 2 }] }, cliente),
      ).rejects.toThrow('no puede superar');
    });

    it('rechaza cuando la sucursal no tiene stock suficiente', async () => {
      const { repos } = reposParaCrear({ stockDisponible: 1, stockReservado: 0 });
      const { service } = crearService({ repos });

      await expect(
        service.crear({ idSucursal: 1, items: [{ idVarianteProducto: 3, cantidad: 2 }] }, cliente),
      ).rejects.toThrow('Stock insuficiente');
    });

    it('limita las reservas activas por cliente', async () => {
      const { repos } = reposParaCrear({ stockDisponible: 5, stockReservado: 0 }, 3);
      const { service } = crearService({ repos });

      await expect(
        service.crear({ idSucursal: 1, items: [{ idVarianteProducto: 3, cantidad: 1 }] }, cliente),
      ).rejects.toThrow(ConflictException);
    });

    it('exige cliente y sucursal', async () => {
      const { service } = crearService();

      await expect(service.crear({ items: [{ idVarianteProducto: 3, cantidad: 1 }] }, admin)).rejects.toThrow('cliente');
      await expect(service.crear({ idCliente: 7, items: [{ idVarianteProducto: 3, cantidad: 1 }] }, admin)).rejects.toThrow('sucursal');
    });
  });

  describe('acceso', () => {
    it('un cliente no puede ver la reserva de otro', async () => {
      const { service } = crearService({ reserva: reservaBase({ idCliente: 99 }) });

      await expect(service.obtener(10, cliente)).rejects.toThrow(NotFoundException);
    });

    it('un empleado no ve reservas de sucursales que no tiene asignadas', async () => {
      const { service } = crearService({ reserva: reservaBase({ idSucursal: 2 }) });

      await expect(service.obtener(10, empleado)).rejects.toThrow(ForbiddenException);
    });

    it('las rutas "mias" son solo para clientes', async () => {
      const { service } = crearService();

      await expect(service.misReservas(empleado)).rejects.toThrow(ForbiddenException);
      await expect(service.crearPropia({ idSucursal: 1, items: [] }, empleado)).rejects.toThrow(ForbiddenException);
      await expect(service.cancelarPropia(10, {}, empleado)).rejects.toThrow(ForbiddenException);
      await expect(service.obtenerPropia(10, admin)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('registrarAnticipo', () => {
    it('no cobra dos veces el anticipo', async () => {
      const repos = new Map<unknown, RepoStub>([[Reserva, { findOne: vi.fn().mockResolvedValue(reservaBase({ estado: 'PAGADA' })) }]]);
      const { service } = crearService({ repos });

      await expect(service.registrarAnticipo(10, { idPasarela: 1 }, admin)).rejects.toThrow('ya fue cobrado');
    });

    it('exige una caja abierta en la sucursal de la reserva', async () => {
      const repos = new Map<unknown, RepoStub>([
        [Reserva, { findOne: vi.fn().mockResolvedValue(reservaBase()) }],
        [Caja, { findOne: vi.fn().mockResolvedValue(null) }],
      ]);
      const { service } = crearService({ repos });

      await expect(service.registrarAnticipo(10, { idPasarela: 1 }, admin)).rejects.toThrow('caja abierta');
    });

    it('no acepta cobros sobre una reserva vencida', async () => {
      const vencida = reservaBase({ fechaLimite: new Date(Date.now() - 1000) });
      const repos = new Map<unknown, RepoStub>([[Reserva, { findOne: vi.fn().mockResolvedValue(vencida) }]]);
      const { service } = crearService({ repos });

      await expect(service.registrarAnticipo(10, { idPasarela: 1 }, admin)).rejects.toThrow('vencio');
    });
  });

  describe('liquidar', () => {
    it('pide metodo de pago mientras quede saldo', async () => {
      const repos = new Map<unknown, RepoStub>([
        [Reserva, { findOne: vi.fn().mockResolvedValue(reservaBase({ estado: 'PAGADA' })) }],
        [DetalleReserva, { find: vi.fn().mockResolvedValue([]) }],
        [Pago, { find: vi.fn().mockResolvedValue([{ monto: 40 }]) }],
      ]);
      const { service } = crearService({ repos });

      await expect(service.liquidar(10, {}, admin)).rejects.toThrow('metodo de pago');
    });

    it('no liquida una reserva cancelada', async () => {
      const repos = new Map<unknown, RepoStub>([[Reserva, { findOne: vi.fn().mockResolvedValue(reservaBase({ estado: 'CANCELADA' })) }]]);
      const { service } = crearService({ repos });

      await expect(service.liquidar(10, { idPasarela: 1 }, admin)).rejects.toThrow('cancelada');
    });
  });

  describe('cancelar', () => {
    function reposParaCancelar(inventario: { stockDisponible: number; stockReservado: number }, reserva: Reserva) {
      const repos = new Map<unknown, RepoStub>();
      repos.set(Reserva, { findOne: vi.fn().mockResolvedValue(reserva), save: vi.fn(async (fila: unknown) => fila) });
      repos.set(DetalleReserva, { find: vi.fn().mockResolvedValue([{ idVarianteProducto: 3, cantidad: 2 }]) });
      repos.set(Almacen, { find: vi.fn().mockResolvedValue([{ id: 1 }]) });
      repos.set(Inventario, { find: vi.fn().mockResolvedValue([inventario]), save: vi.fn(async (fila: unknown) => fila) });
      return repos;
    }

    it('devuelve el stock apartado a disponible', async () => {
      const inventario = { stockDisponible: 3, stockReservado: 2 };
      const reserva = reservaBase();
      const { service } = crearService({ repos: reposParaCancelar(inventario, reserva) });

      await service.cancelar(10, { motivo: 'Ya no lo quiere' }, admin);

      expect(inventario).toEqual({ stockDisponible: 5, stockReservado: 0 });
      expect(reserva.estado).toBe('CANCELADA');
      expect(reserva.observaciones).toContain('Ya no lo quiere');
    });

    it('un cliente no puede cancelar la reserva de otro', async () => {
      const inventario = { stockDisponible: 3, stockReservado: 2 };
      const { service } = crearService({ repos: reposParaCancelar(inventario, reservaBase({ idCliente: 99 })) });

      await expect(service.cancelar(10, {}, cliente)).rejects.toThrow(NotFoundException);
      expect(inventario).toEqual({ stockDisponible: 3, stockReservado: 2 });
    });

    it('no cancela una reserva ya completada', async () => {
      const inventario = { stockDisponible: 3, stockReservado: 2 };
      const { service } = crearService({ repos: reposParaCancelar(inventario, reservaBase({ estado: 'COMPLETADA' })) });

      await expect(service.cancelar(10, {}, admin)).rejects.toThrow(ConflictException);
    });
  });

  describe('vencerVencidas', () => {
    it('cancela las vencidas y libera su stock', async () => {
      const inventario = { stockDisponible: 3, stockReservado: 2 };
      const reserva = reservaBase({ fechaLimite: new Date(Date.now() - 1000) });
      const repos = new Map<unknown, RepoStub>();
      repos.set(Reserva, { findOne: vi.fn().mockResolvedValue(reserva), save: vi.fn(async (fila: unknown) => fila) });
      repos.set(DetalleReserva, { find: vi.fn().mockResolvedValue([{ idVarianteProducto: 3, cantidad: 2 }]) });
      repos.set(Almacen, { find: vi.fn().mockResolvedValue([{ id: 1 }]) });
      repos.set(Inventario, { find: vi.fn().mockResolvedValue([inventario]), save: vi.fn(async (fila: unknown) => fila) });
      const { service } = crearService({ repos, vencidas: [10] });

      await expect(service.vencerVencidas()).resolves.toBe(1);

      expect(reserva.estado).toBe('CANCELADA');
      expect(reserva.observaciones).toContain('vencimiento');
      expect(inventario).toEqual({ stockDisponible: 5, stockReservado: 0 });
    });

    it('ignora una reserva que se completo antes de tomar el bloqueo', async () => {
      const reserva = reservaBase({ estado: 'COMPLETADA', fechaLimite: new Date(Date.now() - 1000) });
      const repos = new Map<unknown, RepoStub>([[Reserva, { findOne: vi.fn().mockResolvedValue(reserva) }]]);
      const { service } = crearService({ repos, vencidas: [10] });

      await expect(service.vencerVencidas()).resolves.toBe(0);
      expect(reserva.estado).toBe('COMPLETADA');
    });
  });
});
