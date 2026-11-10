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

describe('InventarioService.movimientos (kardex)', () => {
  function movimiento(id: number, extra: Partial<MovimientoInventario>): MovimientoInventario {
    return {
      id,
      idEmpresa: 1,
      idAlmacen: 1,
      idVarianteProducto: 10,
      tipo: 'SALIDA_VENTA',
      cantidad: -1,
      deltaReservado: 0,
      stockResultante: 10,
      reservadoResultante: 0,
      costoUnitario: 40,
      referenciaTipo: null,
      referenciaId: null,
      idUsuario: null,
      motivo: null,
      fechaHora: new Date('2026-11-05T10:00:00'),
      ...extra,
    } as MovimientoInventario;
  }

  /** Responde cada consulta de codigos/usuarios segun su tabla, como lo haria Postgres. */
  function crearConKardex(filas: MovimientoInventario[]) {
    const find = vi.fn().mockResolvedValue(filas);
    const query = vi.fn(async (sql: string, [ids]: [number[]]) => {
      if (sql.includes('FROM nota_venta')) return ids.map((id) => ({ id, codigo: `NV-${String(id).padStart(6, '0')}` }));
      if (sql.includes('FROM nota_compra')) return ids.map((id) => ({ id, codigo: id === 3 ? 'NC-3 · Fact. 8812' : `NC-${id}` }));
      if (sql.includes('FROM reserva')) return ids.map((id) => ({ id, codigo: `RS-${id}` }));
      if (sql.includes('FROM usuario')) return ids.map((id) => ({ id, nombre: id === 9 ? 'Ana Lopez' : 'Luis Rojas' }));
      return [];
    });
    const { service } = crearService({
      inventarioRepo: { findByIdConDetalle: vi.fn().mockResolvedValue(inventarioBase()) },
      // El manager falso solo necesita el find del kardex y el query de codigos y usuarios.
      almacenRepo: { manager: { getRepository: () => ({ find }), query } as never },
    });
    return { service, find, query };
  }

  it('trae el codigo del documento y el nombre de quien hizo cada movimiento', async () => {
    const { service } = crearConKardex([
      movimiento(1, { referenciaTipo: 'NOTA_VENTA', referenciaId: 123, idUsuario: 9 }),
      movimiento(2, { tipo: 'ENTRADA_COMPRA', cantidad: 5, referenciaTipo: 'NOTA_COMPRA', referenciaId: 3, idUsuario: 7 }),
      movimiento(3, { tipo: 'TRANSFERENCIA_ENTRADA', cantidad: 2, referenciaTipo: 'TRANSFERENCIA', referenciaId: 4 }),
      movimiento(4, { tipo: 'AJUSTE_SALIDA', referenciaTipo: 'AJUSTE', referenciaId: null, motivo: 'Conteo' }),
    ]);

    const resultado = await service.movimientos(1);

    expect(resultado.map(({ referenciaCodigo, usuarioNombre }) => ({ referenciaCodigo, usuarioNombre }))).toEqual([
      { referenciaCodigo: 'NV-000123', usuarioNombre: 'Ana Lopez' },
      { referenciaCodigo: 'NC-3 · Fact. 8812', usuarioNombre: 'Luis Rojas' },
      { referenciaCodigo: 'TR-4', usuarioNombre: null },
      { referenciaCodigo: null, usuarioNombre: null },
    ]);
  });

  it('hace una consulta por tipo de documento (no una por fila), siempre dentro de la empresa', async () => {
    const { service, query } = crearConKardex([
      movimiento(1, { referenciaTipo: 'NOTA_VENTA', referenciaId: 1, idUsuario: 9 }),
      movimiento(2, { referenciaTipo: 'NOTA_VENTA', referenciaId: 2, idUsuario: 9 }),
      movimiento(3, { referenciaTipo: 'NOTA_VENTA', referenciaId: 2, idUsuario: 9 }),
    ]);

    await service.movimientos(1);

    const consultasVenta = query.mock.calls.filter(([sql]) => sql.includes('FROM nota_venta'));
    expect(consultasVenta).toHaveLength(1);
    expect(consultasVenta[0][1]).toEqual([[1, 2], 1]);
    expect(query.mock.calls.filter(([sql]) => sql.includes('FROM usuario'))).toHaveLength(1);
  });

  it('sin rango trae los ultimos 200; con rango filtra el periodo en hora de Bolivia', async () => {
    const { service, find } = crearConKardex([]);

    await service.movimientos(1);
    expect(find.mock.calls[0][0]).toMatchObject({ take: 200 });
    expect(find.mock.calls[0][0].where.fechaHora).toBeUndefined();

    await service.movimientos(1, { desde: '2026-11-01', hasta: '2026-11-30' });
    const { where, take } = find.mock.calls[1][0];
    expect(take).toBe(1000);
    expect(where.fechaHora.value).toEqual([new Date('2026-11-01T00:00:00'), new Date('2026-11-30T23:59:59.999')]);
  });

  it('rechaza un rango invertido', async () => {
    const { service } = crearConKardex([]);

    await expect(service.movimientos(1, { desde: '2026-11-30', hasta: '2026-11-01' })).rejects.toThrow(BadRequestException);
  });
});
