import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { EMAIL_CONSUMIDOR_FINAL, VentasService } from './ventas.service.js';
import { Cliente } from '../../operaciones/entities/cliente.entity.js';
import { Usuario } from '../../acceso/entities/usuario.entity.js';
import { PasarelaPago } from '../entities/pasarela-pago.entity.js';
import { VarianteProducto } from '../../inventario/entities/variante-producto.entity.js';
import { Inventario } from '../../inventario/entities/inventario.entity.js';
import { Caja } from '../entities/caja.entity.js';
import { Sucursal } from '../../operaciones/entities/sucursal.entity.js';
import { Almacen } from '../../inventario/entities/almacen.entity.js';
import { ProductoSucursal } from '../../inventario/entities/producto-sucursal.entity.js';
import { DetalleNotaVenta } from '../entities/detalle-nota-venta.entity.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import type { NotaVenta } from '../entities/nota-venta.entity.js';

const usuarioEmpleado: ActiveUser = {
  sub: 5,
  tipoUsuario: 'E',
  permisos: [],
  jti: 'x',
  sucursalId: 1,
};

function ventaBase(overrides: Partial<NotaVenta> = {}): NotaVenta {
  return {
    id: 99,
    codigoNota: 'NV-000001',
    idCliente: 1,
    cliente: { usuario: { nombre: 'Ana', apellido: 'Perez' } } as never,
    idCajero: 5,
    cajero: null,
    idSucursal: 1,
    sucursal: { nombre: 'Central' } as never,
    idPasarela: 1,
    pasarela: null,
    idMovimientoCaja: 55,
    movimientoCaja: null,
    tipo: 'PRESENCIAL',
    tipoVenta: 'DIRECTA_PRESENCIAL',
    nroFactura: null,
    nitRazonSocial: null,
    fechaEmision: '2026-09-21',
    horaEmision: '10:00:00',
    subtotal: 100,
    montoAnticipoAplicado: 0,
    descuento: 0,
    impuesto: 0,
    montoTotal: 100,
    estadoPago: 'Pagado',
    detalles: [],
    pagos: [],
    ...overrides,
  };
}

interface RepoStub {
  findOne: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
}

function crearService(config: {
  cliente?: unknown;
  caja?: unknown;
  pasarela?: unknown;
  variante?: unknown;
  /** Filas de INVENTARIO de la variante en los almacenes de la sucursal. */
  inventarios?: unknown[];
  ventaDetalle?: NotaVenta | null;
  sucursal?: unknown;
  /** Almacenes activos de la sucursal. */
  almacenes?: unknown[];
  productoSucursal?: unknown;
} = {}) {
  const repos = new Map<unknown, RepoStub>();
  const repo = (): RepoStub => ({ findOne: vi.fn(), find: vi.fn(), create: vi.fn((x) => x), save: vi.fn((x) => Promise.resolve(x)) });
  const repoDe = (entity: unknown): RepoStub => {
    let stub = repos.get(entity);
    if (!stub) {
      stub = repo();
      repos.set(entity, stub);
    }
    return stub;
  };

  repoDe(Cliente).findOne.mockResolvedValue(config.cliente ?? { idUsuario: 1 });
  // Por defecto la sucursal 1 (la del cajero) tiene un almacen activo.
  repoDe(Sucursal).findOne.mockResolvedValue(config.sucursal !== undefined ? config.sucursal : { id: 1, activo: true });
  repoDe(Almacen).find.mockResolvedValue(config.almacenes ?? [{ id: 2 }]);
  repoDe(ProductoSucursal).findOne.mockResolvedValue(config.productoSucursal !== undefined ? config.productoSucursal : { idSucursal: 1, idProducto: 1, activo: true });
  repoDe(Caja).findOne.mockResolvedValue(
    config.caja !== undefined ? config.caja : { id: 10, idSucursal: 1, estado: 'Abierta' },
  );
  repoDe(PasarelaPago).findOne.mockResolvedValue(config.pasarela ?? { id: 1, disponiblePresencial: true });
  repoDe(VarianteProducto).findOne.mockResolvedValue(
    config.variante ?? { id: 7, idProducto: 1, activo: true, sku: 'SKU-1', talla: 'M', color: 'Rojo', producto: { nombre: 'Camisa', precio: 50, activo: true } },
  );
  repoDe(Inventario).find.mockResolvedValue(
    config.inventarios ?? [{ id: 3, idAlmacen: 2, idVarianteProducto: 7, stockDisponible: 10 }],
  );
  repoDe(DetalleNotaVenta);

  const manager = { getRepository: vi.fn((entity: unknown) => repoDe(entity)) };
  const dataSource = { transaction: vi.fn(async (cb: (m: unknown) => unknown) => cb(manager)) };

  const notaVentaRepo = {
    findPage: vi.fn(),
    findByIdConDetalle: vi.fn().mockResolvedValue(config.ventaDetalle === undefined ? ventaBase() : config.ventaDetalle),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn((datos) => ({ ...datos, id: 99 })),
    save: vi.fn((x) => Promise.resolve(x)),
  };
  const pagoRepo = {
    create: vi.fn((datos) => ({ ...datos, id: 77 })),
    save: vi.fn((x) => Promise.resolve(x)),
  };
  const movimientoCajaRepo = {
    create: vi.fn((datos) => ({ ...datos, id: 55 })),
    save: vi.fn((x) => Promise.resolve(x)),
  };

  return {
    service: new VentasService(
      dataSource as never,
      notaVentaRepo as never,
      pagoRepo as never,
      movimientoCajaRepo as never,
    ),
    dataSource,
    notaVentaRepo,
    pagoRepo,
    movimientoCajaRepo,
    repoDe,
  };
}

const dtoBase = {
  idCliente: 1,
  idPasarela: 1,
  items: [{ idVarianteProducto: 7, cantidad: 2 }],
};

describe('VentasService', () => {
  it('toma el stock de los almacenes activos de la sucursal sin que el cajero elija uno', async () => {
    const { service, repoDe } = crearService();

    await service.crear(dtoBase, usuarioEmpleado);

    expect(repoDe(Almacen).find).toHaveBeenCalledWith(expect.objectContaining({ where: { idSucursal: 1, activo: true } }));
    const busqueda = repoDe(Inventario).find.mock.calls[0][0] as { where: { idVarianteProducto: number } };
    expect(busqueda.where.idVarianteProducto).toBe(7);
  });

  it('reparte la venta entre almacenes, empezando por el que mas stock tiene', async () => {
    const chico = { id: 3, idAlmacen: 2, idVarianteProducto: 7, stockDisponible: 1 };
    const grande = { id: 4, idAlmacen: 5, idVarianteProducto: 7, stockDisponible: 4 };
    const { service } = crearService({ inventarios: [chico, grande], almacenes: [{ id: 2 }, { id: 5 }] });

    await service.crear({ ...dtoBase, items: [{ idVarianteProducto: 7, cantidad: 5 }] }, usuarioEmpleado);

    expect(grande.stockDisponible).toBe(0);
    expect(chico.stockDisponible).toBe(0);
  });

  it('suma las lineas repetidas de una misma variante antes de validar el stock', async () => {
    const { service } = crearService({ inventarios: [{ id: 3, idAlmacen: 2, idVarianteProducto: 7, stockDisponible: 3 }] });

    await expect(
      service.crear(
        {
          ...dtoBase,
          items: [
            { idVarianteProducto: 7, cantidad: 2 },
            { idVarianteProducto: 7, cantidad: 2 },
          ],
        },
        usuarioEmpleado,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza vender si la sucursal no tiene almacenes activos con stock', async () => {
    const sinAlmacenes = crearService({ almacenes: [], inventarios: [] });
    await expect(sinAlmacenes.service.crear(dtoBase, usuarioEmpleado)).rejects.toThrow(BadRequestException);
  });

  it('rechaza un producto que no esta activo en la sucursal o que se desactivo', async () => {
    const sinActivar = crearService({ productoSucursal: null });
    await expect(sinActivar.service.crear(dtoBase, usuarioEmpleado)).rejects.toThrow(ConflictException);

    const inactiva = crearService({ variante: { id: 7, idProducto: 1, activo: false, sku: 'SKU-1', talla: 'M', color: 'Rojo', producto: { nombre: 'Camisa', precio: 50, activo: true } } });
    await expect(inactiva.service.crear(dtoBase, usuarioEmpleado)).rejects.toThrow(ConflictException);
  });

  it('rechaza vender en una sucursal inactiva o inexistente', async () => {
    const inactiva = crearService({ sucursal: { id: 1, activo: false } });
    await expect(inactiva.service.crear(dtoBase, usuarioEmpleado)).rejects.toThrow(ConflictException);

    const inexistente = crearService({ sucursal: null });
    await expect(inexistente.service.crear(dtoBase, usuarioEmpleado)).rejects.toThrow(NotFoundException);
  });

  it('rechaza la venta si la sucursal no tiene caja abierta', async () => {
    const { service, dataSource } = crearService({ caja: null });

    await expect(service.crear(dtoBase, usuarioEmpleado)).rejects.toThrow(ConflictException);
    expect(dataSource.transaction).toHaveBeenCalled();
  });

  it('rechaza la venta si el stock es insuficiente', async () => {
    const { service } = crearService({ inventarios: [{ id: 3, idAlmacen: 2, idVarianteProducto: 7, stockDisponible: 1 }] });

    await expect(service.crear(dtoBase, usuarioEmpleado)).rejects.toThrow(BadRequestException);
  });

  it('registra la venta, el pago, el movimiento y descuenta stock', async () => {
    const { service, notaVentaRepo, pagoRepo, movimientoCajaRepo, repoDe } = crearService();

    const response = await service.crear(dtoBase, usuarioEmpleado);

    expect(notaVentaRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        codigoNota: 'NV-000001',
        idCliente: 1,
        idCajero: 5,
        idSucursal: 1,
        idMovimientoCaja: 55,
        tipoVenta: 'DIRECTA_PRESENCIAL',
        subtotal: 100,
        montoTotal: 100,
      }),
      expect.anything(),
    );
    expect(movimientoCajaRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ idCaja: 10, tipo: 'INGRESO', monto: '100.00' }),
      expect.anything(),
    );
    expect(pagoRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ idNotaVenta: 99, monto: 100, concepto: 'PAGO_TOTAL' }),
      expect.anything(),
    );
    const inventarioGuardado = repoDe(Inventario).save.mock.calls[0][0] as { stockDisponible: number };
    expect(inventarioGuardado.stockDisponible).toBe(8);
    expect(response.id).toBe(99);
  });

  it('aplica descuento e impuesto al total', async () => {
    const { service, notaVentaRepo } = crearService();

    await service.crear({ ...dtoBase, descuento: 10, impuesto: 5 }, usuarioEmpleado);

    expect(notaVentaRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ subtotal: 100, descuento: 10, impuesto: 5, montoTotal: 95 }),
      expect.anything(),
    );
  });

  it('lista ventas paginadas', async () => {
    const { service, notaVentaRepo } = crearService();
    notaVentaRepo.findPage.mockResolvedValue({ items: [ventaBase()], total: 1 });

    const response = await service.listar({ page: 1, limit: 10 });

    expect(response.items).toHaveLength(1);
    expect(response.meta).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
  });

  it('lanza NotFound si la venta no existe', async () => {
    const { service } = crearService({ ventaDetalle: null });

    await expect(service.obtener(123)).rejects.toThrow(NotFoundException);
  });

  describe('cliente opcional', () => {
    it('sin cliente, la venta queda a nombre del consumidor final ya existente', async () => {
      const { service, notaVentaRepo, repoDe } = crearService();
      repoDe(Usuario).findOne.mockResolvedValue({ id: 42, email: EMAIL_CONSUMIDOR_FINAL });
      repoDe(Cliente).findOne.mockResolvedValue({ idUsuario: 42 });

      const { idCliente: _omitido, ...sinCliente } = dtoBase;
      await service.crear(sinCliente, usuarioEmpleado);

      expect(notaVentaRepo.create).toHaveBeenCalledWith(expect.objectContaining({ idCliente: 42 }), expect.anything());
      expect(repoDe(Usuario).save).not.toHaveBeenCalled();
    });

    it('crea al consumidor final la primera vez, sin acceso posible al sistema', async () => {
      const { service, notaVentaRepo, repoDe } = crearService();
      repoDe(Usuario).findOne.mockResolvedValue(null);
      repoDe(Usuario).save.mockImplementation(async (datos: Record<string, unknown>) => ({ ...datos, id: 50 }));
      repoDe(Cliente).findOne.mockResolvedValue(null);

      const { idCliente: _omitido, ...sinCliente } = dtoBase;
      await service.crear(sinCliente, usuarioEmpleado);

      const creado = repoDe(Usuario).save.mock.calls[0][0] as Record<string, unknown>;
      expect(creado).toMatchObject({ email: EMAIL_CONSUMIDOR_FINAL, tipoUsuario: 'C', activo: false, estadoAcceso: 'SUSPENDIDO' });
      expect(String(creado.passwordHash)).toMatch(/^\$2[aby]\$/);
      expect(repoDe(Cliente).save).toHaveBeenCalledWith(expect.objectContaining({ idUsuario: 50 }));
      expect(notaVentaRepo.create).toHaveBeenCalledWith(expect.objectContaining({ idCliente: 50 }), expect.anything());
    });

    it('con cliente indicado no toca al consumidor final y sigue validando que exista', async () => {
      const { service, repoDe } = crearService();

      await service.crear(dtoBase, usuarioEmpleado);
      expect(repoDe(Usuario).findOne).not.toHaveBeenCalled();

      const inexistente = crearService({ cliente: null });
      inexistente.repoDe(Cliente).findOne.mockResolvedValue(null);
      await expect(inexistente.service.crear(dtoBase, usuarioEmpleado)).rejects.toThrow(NotFoundException);
    });
  });

});
