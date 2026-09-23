import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ComprasService } from './compras.service.js';
import { NotaCompra } from '../entities/nota-compra.entity.js';
import { DetalleNotaCompra } from '../entities/detalle-nota-compra.entity.js';
import { Caja } from '../entities/caja.entity.js';
import { MovimientoCaja } from '../entities/movimiento-caja.entity.js';
import { Inventario } from '../../inventario/entities/inventario.entity.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import type { CrearCompraDto } from '../dto/crear-compra.dto.js';

const admin: ActiveUser = { sub: 1, tipoUsuario: 'A', permisos: [], jti: 'x' };
const empleado: ActiveUser = { sub: 5, tipoUsuario: 'E', permisos: [], jti: 'x' };

function dtoBase(overrides: Partial<CrearCompraDto> = {}): CrearCompraDto {
  return {
    idProveedor: 1,
    idSucursal: 2,
    nroFactura: 'F-100',
    detalles: [
      { idVarianteProducto: 10, idAlmacen: 7, cantidad: 4, precioUnitario: 25.5, nroLote: 'L1' },
      { idVarianteProducto: 11, idAlmacen: 7, cantidad: 2, precioUnitario: 10 },
    ],
    ...overrides,
  };
}

function compraGuardada() {
  return {
    id: 50,
    idProveedor: 1,
    idSucursal: 2,
    idMovimientoCaja: null,
    nroFactura: 'F-100',
    fechaEmision: new Date('2026-09-21T10:00:00Z'),
    fechaEntregaProgramada: null,
    fechaPago: null,
    subtotal: '122.00',
    total: '122.00',
    estado: 'Recibido',
    proveedor: { empresa: 'Textiles SRL' },
    sucursal: { nombre: 'Central' },
    detalles: [],
  };
}

function crearService(
  overrides: {
    proveedor?: unknown;
    sucursal?: unknown;
    asignacion?: unknown;
    almacenes?: unknown[];
    variantes?: unknown[];
    activados?: unknown[];
    facturaRepetida?: unknown;
    cajaAbierta?: unknown;
    inventarioExistente?: Record<number, { idVarianteProducto: number; stockDisponible: number }>;
    compraRepo?: Record<string, ReturnType<typeof vi.fn>>;
  } = {},
) {
  const has = (clave: keyof typeof overrides) => clave in overrides;

  const notaCompraRepo = {
    create: vi.fn((datos) => ({ ...datos })),
    save: vi.fn((datos) => Promise.resolve({ ...compraGuardada(), ...datos })),
  };
  const detalleRepo = { create: vi.fn((datos) => datos), save: vi.fn((datos) => Promise.resolve(datos)) };
  const inventarioRepo = {
    findOne: vi.fn(({ where }: { where: { idVarianteProducto: number } }) =>
      Promise.resolve(overrides.inventarioExistente?.[where.idVarianteProducto] ?? null),
    ),
    create: vi.fn((datos) => datos),
    save: vi.fn((datos) => Promise.resolve(datos)),
  };
  const cajaRepo = { findOne: vi.fn().mockResolvedValue(has('cajaAbierta') ? overrides.cajaAbierta : null) };
  const movimientoRepo = {
    create: vi.fn((datos) => datos),
    save: vi.fn((datos) => Promise.resolve({ id: 900, ...datos })),
  };

  const repos = new Map<unknown, unknown>([
    [NotaCompra, notaCompraRepo],
    [DetalleNotaCompra, detalleRepo],
    [Inventario, inventarioRepo],
    [Caja, cajaRepo],
    [MovimientoCaja, movimientoRepo],
  ]);
  const manager = { getRepository: (entidad: unknown) => repos.get(entidad) };
  const dataSource = { transaction: vi.fn((callback: (m: typeof manager) => Promise<unknown>) => callback(manager)) };

  const compraRepo = {
    findPage: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findByIdConDetalle: vi.fn().mockResolvedValue(compraGuardada()),
    findPorFactura: vi.fn().mockResolvedValue(overrides.facturaRepetida ?? null),
    ...overrides.compraRepo,
  };
  const proveedorRepo = {
    findOne: vi.fn().mockResolvedValue(has('proveedor') ? overrides.proveedor : { id: 1, empresa: 'Textiles SRL', activo: true }),
  };
  const sucursalRepo = {
    findOne: vi.fn().mockResolvedValue(has('sucursal') ? overrides.sucursal : { id: 2, activo: true }),
  };
  const empleadoSucursalRepo = {
    findOne: vi.fn(),
    find: vi.fn().mockResolvedValue(has('asignacion') ? overrides.asignacion : [{ idEmpleado: 5, idSucursal: 2, activo: true }]),
  };
  const almacenRepo = {
    find: vi.fn().mockResolvedValue(overrides.almacenes ?? [{ id: 7, nombre: 'Deposito', idSucursal: 2, activo: true }]),
  };
  const varianteRepo = {
    find: vi.fn().mockResolvedValue(
      overrides.variantes ?? [
        { id: 10, sku: 'SKU-10', idProducto: 5, activo: true },
        { id: 11, sku: 'SKU-11', idProducto: 5, activo: true },
      ],
    ),
  };
  const productoSucursalRepo = {
    find: vi.fn().mockResolvedValue(overrides.activados ?? [{ idProducto: 5, idSucursal: 2, activo: true }]),
  };

  return {
    service: new ComprasService(
      compraRepo as never,
      dataSource as never,
      proveedorRepo as never,
      sucursalRepo as never,
      empleadoSucursalRepo as never,
      almacenRepo as never,
      varianteRepo as never,
      productoSucursalRepo as never,
    ),
    dataSource,
    compraRepo,
    notaCompraRepo,
    detalleRepo,
    inventarioRepo,
    movimientoRepo,
  };
}

describe('ComprasService', () => {
  it('registra la compra, calcula el total y suma el stock en los almacenes', async () => {
    const { service, notaCompraRepo, detalleRepo, inventarioRepo } = crearService({
      inventarioExistente: { 10: { idVarianteProducto: 10, stockDisponible: 6 } },
    });

    await service.registrar(dtoBase(), admin);

    // 4 x 25.50 + 2 x 10.00
    expect(notaCompraRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ idSucursal: 2, total: '122.00', subtotal: '122.00', estado: 'Recibido', nroFactura: 'F-100' }),
    );
    expect(detalleRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({ idVarianteProducto: 10, cantidad: 4, subtotal: '102.00', nroLote: 'L1' }),
      expect.objectContaining({ idVarianteProducto: 11, cantidad: 2, subtotal: '20.00', nroLote: null }),
    ]);
    // La variante 10 ya existia en el almacen (6 + 4); la 11 abre un registro nuevo.
    expect(inventarioRepo.save).toHaveBeenCalledWith(expect.objectContaining({ idVarianteProducto: 10, stockDisponible: 10 }));
    expect(inventarioRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ idAlmacen: 7, idVarianteProducto: 11, stockDisponible: 2, stockMinimo: 5 }),
    );
  });

  it('no toca la caja si la compra no se paga desde caja', async () => {
    const { service, movimientoRepo } = crearService();

    await service.registrar(dtoBase(), admin);

    expect(movimientoRepo.save).not.toHaveBeenCalled();
  });

  it('paga desde la caja abierta de la sucursal con un egreso por el total y lo vincula a la compra', async () => {
    const { service, notaCompraRepo, movimientoRepo } = crearService({ cajaAbierta: { id: 30, idSucursal: 2 } });

    await service.registrar(dtoBase({ pagarEnCaja: true }), admin);

    expect(movimientoRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ idCaja: 30, tipo: 'EGRESO', monto: '122.00', concepto: 'Compra F-100 - Textiles SRL' }),
    );
    expect(notaCompraRepo.save).toHaveBeenLastCalledWith(expect.objectContaining({ idMovimientoCaja: 900 }));
  });

  it('rechaza pagar desde caja cuando la sucursal no tiene caja abierta', async () => {
    const { service } = crearService();

    await expect(service.registrar(dtoBase({ pagarEnCaja: true }), admin)).rejects.toThrow(ConflictException);
  });

  it('rechaza un almacen que no es de la sucursal de la compra', async () => {
    const { service, dataSource } = crearService({
      almacenes: [{ id: 7, nombre: 'Deposito Beni', idSucursal: 3, activo: true }],
    });

    await expect(service.registrar(dtoBase(), admin)).rejects.toThrow(BadRequestException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rechaza un producto que no esta activo en la sucursal', async () => {
    const { service, dataSource } = crearService({ activados: [] });

    await expect(service.registrar(dtoBase(), admin)).rejects.toThrow(ConflictException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rechaza proveedor inactivo, sucursal inactiva y factura repetida', async () => {
    const proveedorInactivo = crearService({ proveedor: { id: 1, empresa: 'X', activo: false } });
    await expect(proveedorInactivo.service.registrar(dtoBase(), admin)).rejects.toThrow(ConflictException);

    const sucursalInactiva = crearService({ sucursal: { id: 2, activo: false } });
    await expect(sucursalInactiva.service.registrar(dtoBase(), admin)).rejects.toThrow(ConflictException);

    const facturaRepetida = crearService({ facturaRepetida: { id: 9 } });
    await expect(facturaRepetida.service.registrar(dtoBase(), admin)).rejects.toThrow(ConflictException);
    expect(facturaRepetida.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('un empleado solo puede comprar para una sucursal que tiene asignada', async () => {
    const { service, dataSource } = crearService({ asignacion: [{ idEmpleado: 5, idSucursal: 9, activo: true }] });

    await expect(service.registrar(dtoBase(), empleado)).rejects.toThrow(ForbiddenException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('limita el listado de un empleado a sus sucursales y rechaza filtrar por otra', async () => {
    const { service, compraRepo } = crearService();

    await service.listar({ page: 1, limit: 20 }, empleado);
    expect(compraRepo.findPage).toHaveBeenCalledWith(expect.objectContaining({ idsSucursal: [2] }));

    await expect(service.listar({ page: 1, limit: 20, idSucursal: 8 }, empleado)).rejects.toThrow(ForbiddenException);
  });

  it('el administrador lista sin restriccion de sucursal', async () => {
    const { service, compraRepo } = crearService();

    await service.listar({ page: 1, limit: 20, idProveedor: 1 }, admin);

    expect(compraRepo.findPage).toHaveBeenCalledWith(expect.objectContaining({ idProveedor: 1, idsSucursal: undefined }));
  });
});
