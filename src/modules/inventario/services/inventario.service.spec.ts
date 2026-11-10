import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InventarioService } from './inventario.service.js';
import { Inventario } from '../entities/inventario.entity.js';
import { MovimientoInventario } from '../entities/movimiento-inventario.entity.js';
import { VarianteProducto } from '../entities/variante-producto.entity.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';

const usuario: ActiveUser = { sub: 9, tipoUsuario: 'E', permisos: [], jti: 'x' };

function inventarioBase(overrides: Partial<Inventario> = {}): Inventario {
  return {
    id: 1,
    idAlmacen: 1,
    almacen: { id: 1, idSucursal: 2, nombre: 'Deposito Central', ubicacionFisica: null, activo: true, sucursal: { id: 2, nombre: 'Sucursal Centro' }, inventarios: [] } as never,
    idVarianteProducto: 10,
    variante: { id: 10, sku: 'SKU-1', talla: 'M', color: 'Rojo', producto: { id: 5, nombre: 'Camisa' } } as never,
    stockDisponible: 3,
    stockReservado: 0,
    stockMinimo: 5,
    stockMaximo: 500,
    ...overrides,
  };
}

function crearService(overrides: {
  inventarioRepo?: Record<string, ReturnType<typeof vi.fn>>;
  almacenRepo?: Record<string, ReturnType<typeof vi.fn>>;
  varianteRepo?: Record<string, ReturnType<typeof vi.fn>>;
  productoSucursalRepo?: Record<string, ReturnType<typeof vi.fn>>;
  /** Fila que devuelve el SELECT ... FOR UPDATE dentro de la transaccion del ajuste. */
  filaBloqueada?: Inventario | null;
} = {}) {
  const inventarioRepo = {
    findPage: vi.fn(),
    findByIdConDetalle: vi.fn(),
    findByAlmacenYVariante: vi.fn(),
    ...overrides.inventarioRepo,
  };

  // Lo que pasa dentro de la transaccion: la fila de stock, el kardex y el costo de la variante.
  const movimientos: Array<Record<string, unknown>> = [];
  const inventarioTx = {
    findOne: vi.fn().mockResolvedValue(overrides.filaBloqueada ?? null),
    // Stock previo de la variante (para el costo promedio): sin otras filas.
    find: vi.fn().mockResolvedValue([]),
    create: vi.fn((datos) => ({ id: 1, ...datos })),
    save: vi.fn((datos) => Promise.resolve(datos)),
  };
  const kardex = {
    create: vi.fn((datos) => datos),
    save: vi.fn((datos) => {
      movimientos.push(datos);
      return Promise.resolve(datos);
    }),
  };
  const varianteTx = { findOne: vi.fn().mockResolvedValue({ id: 10, costoPromedio: null }), save: vi.fn((datos) => Promise.resolve(datos)) };
  const txManager = {
    getRepository: (entidad: unknown) =>
      entidad === Inventario ? inventarioTx : entidad === MovimientoInventario ? kardex : entidad === VarianteProducto ? varianteTx : undefined,
  };

  const almacenRepo = {
    findOne: vi.fn(),
    manager: { transaction: vi.fn((cb: (m: typeof txManager) => unknown) => cb(txManager)), getRepository: txManager.getRepository },
    ...overrides.almacenRepo,
  };
  const varianteRepo = { findOne: vi.fn(), ...overrides.varianteRepo };
  // Por defecto el producto esta activo en la sucursal del almacen.
  const productoSucursalRepo = {
    findOne: vi.fn().mockResolvedValue({ idProducto: 5, idSucursal: 2, activo: true }),
    ...overrides.productoSucursalRepo,
  };

  return {
    service: new InventarioService(
      inventarioRepo as never,
      almacenRepo as never,
      varianteRepo as never,
      productoSucursalRepo as never,
      { empresaId: () => 1 } as never,
    ),
    inventarioRepo,
    inventarioTx,
    movimientos,
    varianteTx,
    productoSucursalRepo,
  };
}

const conAlmacenYVariante = {
  almacenRepo: { findOne: vi.fn().mockResolvedValue({ id: 1, idSucursal: 2, activo: true }) },
  varianteRepo: { findOne: vi.fn().mockResolvedValue({ id: 10, idProducto: 5, activo: true }) },
};

describe('InventarioService', () => {
  it('registra una variante nueva en un almacen y su saldo inicial en el kardex', async () => {
    const inventario = inventarioBase();
    const { service, inventarioRepo, inventarioTx, movimientos } = crearService({
      ...conAlmacenYVariante,
      inventarioRepo: {
        findByAlmacenYVariante: vi.fn().mockResolvedValue(null),
        findByIdConDetalle: vi.fn().mockResolvedValue(inventario),
      },
    });

    const response = await service.registrar({ idAlmacen: 1, idVarianteProducto: 10, stockDisponible: 3 }, usuario);

    expect(inventarioRepo.findByAlmacenYVariante).toHaveBeenCalledWith(1, 10);
    expect(inventarioTx.save).toHaveBeenCalledWith(expect.objectContaining({ idAlmacen: 1, idVarianteProducto: 10, stockDisponible: 3 }));
    expect(movimientos).toEqual([expect.objectContaining({ tipo: 'SALDO_INICIAL', cantidad: 3, stockResultante: 3, idUsuario: 9 })]);
    expect(response.id).toBe(1);
    expect(response.bajoMinimo).toBe(true);
  });

  it('con costo, el stock inicial entra al costo promedio de la variante', async () => {
    const { service, varianteTx, movimientos } = crearService({
      ...conAlmacenYVariante,
      inventarioRepo: { findByAlmacenYVariante: vi.fn().mockResolvedValue(null), findByIdConDetalle: vi.fn().mockResolvedValue(inventarioBase()) },
    });

    await service.registrar({ idAlmacen: 1, idVarianteProducto: 10, stockDisponible: 3, costoUnitario: 42 }, usuario);

    expect(varianteTx.save).toHaveBeenCalledWith(expect.objectContaining({ id: 10, costoPromedio: 42 }));
    expect(movimientos[0]).toMatchObject({ costoUnitario: 42 });
  });

  it('sin stock inicial no deja movimiento en el kardex', async () => {
    const { service, movimientos } = crearService({
      ...conAlmacenYVariante,
      inventarioRepo: { findByAlmacenYVariante: vi.fn().mockResolvedValue(null), findByIdConDetalle: vi.fn().mockResolvedValue(inventarioBase()) },
    });

    await service.registrar({ idAlmacen: 1, idVarianteProducto: 10 }, usuario);

    expect(movimientos).toEqual([]);
  });

  it('rechaza registrar dos veces la misma variante en el mismo almacen', async () => {
    const { service } = crearService({
      ...conAlmacenYVariante,
      inventarioRepo: { findByAlmacenYVariante: vi.fn().mockResolvedValue(inventarioBase()) },
    });

    await expect(service.registrar({ idAlmacen: 1, idVarianteProducto: 10 }, usuario)).rejects.toThrow(ConflictException);
  });

  it('rechaza registrar stock de un producto que no esta activo en la sucursal del almacen', async () => {
    const { service, inventarioTx, productoSucursalRepo } = crearService({
      ...conAlmacenYVariante,
      productoSucursalRepo: { findOne: vi.fn().mockResolvedValue(null) },
    });

    await expect(service.registrar({ idAlmacen: 1, idVarianteProducto: 10 }, usuario)).rejects.toThrow(ConflictException);
    expect(productoSucursalRepo.findOne).toHaveBeenCalledWith({
      where: { idProducto: 5, idSucursal: 2, activo: true },
    });
    expect(inventarioTx.save).not.toHaveBeenCalled();
  });

  it('rechaza registrar en un almacen inactivo o con una variante inactiva', async () => {
    const almacenInactivo = crearService({
      almacenRepo: { findOne: vi.fn().mockResolvedValue({ id: 1, idSucursal: 2, activo: false }) },
    });
    await expect(almacenInactivo.service.registrar({ idAlmacen: 1, idVarianteProducto: 10 }, usuario)).rejects.toThrow(ConflictException);

    const varianteInactiva = crearService({
      almacenRepo: conAlmacenYVariante.almacenRepo,
      varianteRepo: { findOne: vi.fn().mockResolvedValue({ id: 10, idProducto: 5, activo: false }) },
    });
    await expect(varianteInactiva.service.registrar({ idAlmacen: 1, idVarianteProducto: 10 }, usuario)).rejects.toThrow(ConflictException);
  });

  it('rechaza registrar si el almacen no existe', async () => {
    const { service, inventarioTx } = crearService({
      almacenRepo: { findOne: vi.fn().mockResolvedValue(null) },
    });

    await expect(service.registrar({ idAlmacen: 99, idVarianteProducto: 10 }, usuario)).rejects.toThrow(NotFoundException);
    expect(inventarioTx.save).not.toHaveBeenCalled();
  });

  it('una salida no puede dejar el stock en negativo', async () => {
    const inventario = inventarioBase({ stockDisponible: 3 });
    const { service, inventarioTx, movimientos } = crearService({
      inventarioRepo: { findByIdConDetalle: vi.fn().mockResolvedValue(inventario) },
      filaBloqueada: inventario,
    });

    await expect(service.ajustar(1, { tipo: 'SALIDA', cantidad: 5 }, usuario)).rejects.toThrow(BadRequestException);
    expect(inventarioTx.save).not.toHaveBeenCalled();
    expect(movimientos).toEqual([]);
  });

  it('una entrada incrementa el stock disponible y queda en el kardex con su motivo', async () => {
    const inventario = inventarioBase({ stockDisponible: 3 });
    const { service, inventarioTx, movimientos } = crearService({
      inventarioRepo: { findByIdConDetalle: vi.fn().mockResolvedValue(inventario) },
      filaBloqueada: inventario,
    });

    await service.ajustar(1, { tipo: 'ENTRADA', cantidad: 2, motivo: 'Devolucion de proveedor' }, usuario);

    expect(inventario.stockDisponible).toBe(5);
    expect(inventarioTx.findOne).toHaveBeenCalledWith({ where: { id: 1 }, lock: { mode: 'pessimistic_write' } });
    expect(inventarioTx.save).toHaveBeenCalledWith(inventario);
    expect(movimientos).toEqual([
      expect.objectContaining({ tipo: 'AJUSTE_ENTRADA', cantidad: 2, stockResultante: 5, referenciaTipo: 'AJUSTE', idUsuario: 9, motivo: 'Devolucion de proveedor' }),
    ]);
  });

  it('un ajuste fija el stock al valor indicado y registra la diferencia, no el valor', async () => {
    const inventario = inventarioBase({ stockDisponible: 43 });
    const { service, movimientos } = crearService({
      inventarioRepo: { findByIdConDetalle: vi.fn().mockResolvedValue(inventario) },
      filaBloqueada: inventario,
    });

    await service.ajustar(1, { tipo: 'AJUSTE', cantidad: 40 }, usuario);

    expect(inventario.stockDisponible).toBe(40);
    expect(movimientos).toEqual([expect.objectContaining({ tipo: 'AJUSTE_SALIDA', cantidad: -3, stockResultante: 40, motivo: 'Conteo de inventario' })]);
  });

  it('un ajuste al mismo valor no deja movimiento', async () => {
    const inventario = inventarioBase({ stockDisponible: 7 });
    const { service, movimientos } = crearService({
      inventarioRepo: { findByIdConDetalle: vi.fn().mockResolvedValue(inventario) },
      filaBloqueada: inventario,
    });

    await service.ajustar(1, { tipo: 'AJUSTE', cantidad: 7 }, usuario);

    expect(movimientos).toEqual([]);
  });

  it('no ajusta un registro de otra empresa', async () => {
    const { service } = crearService({ inventarioRepo: { findByIdConDetalle: vi.fn().mockResolvedValue(null) } });

    await expect(service.ajustar(1, { tipo: 'ENTRADA', cantidad: 1 }, usuario)).rejects.toThrow(NotFoundException);
  });
});
