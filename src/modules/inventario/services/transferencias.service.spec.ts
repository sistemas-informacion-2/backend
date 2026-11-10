import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { TransferenciasService } from './transferencias.service.js';
import { Inventario } from '../entities/inventario.entity.js';
import { MovimientoInventario } from '../entities/movimiento-inventario.entity.js';
import { TransferenciaInventario } from '../entities/transferencia-inventario.entity.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import type { TransferirStockDto } from '../dto/transferencia.dto.js';

const usuario: ActiveUser = { sub: 9, tipoUsuario: 'E', permisos: [], jti: 'x' };

const ORIGEN = { id: 1, idEmpresa: 1, idSucursal: 2, nombre: 'Deposito Central', activo: true };
const DESTINO = { id: 2, idEmpresa: 1, idSucursal: 3, nombre: 'Tienda Norte', activo: true };
const VARIANTE = { id: 10, idEmpresa: 1, idProducto: 5, sku: 'SKU-1', activo: true, costoPromedio: 40 };

function fila(idAlmacen: number, stockDisponible: number, stockReservado = 0): Inventario {
  return { id: idAlmacen * 100, idAlmacen, idVarianteProducto: 10, stockDisponible, stockReservado, stockMinimo: 5, stockMaximo: 500 } as Inventario;
}

function dto(overrides: Partial<TransferirStockDto> = {}): TransferirStockDto {
  return { idAlmacenOrigen: 1, idAlmacenDestino: 2, idVarianteProducto: 10, cantidad: 4, motivo: '  Reponer vitrina  ', ...overrides };
}

function crearService(opciones: {
  almacenes?: unknown[];
  variante?: unknown;
  productoActivo?: unknown;
  /** Filas de stock que devuelve el SELECT ... FOR UPDATE. */
  filas?: Inventario[];
} = {}) {
  const movimientos: Array<Record<string, unknown>> = [];
  const guardadas: Inventario[] = [];
  const inventarioTx = {
    find: vi.fn().mockResolvedValue(opciones.filas ?? [fila(1, 10), fila(2, 3)]),
    create: vi.fn((datos) => ({ ...datos })),
    save: vi.fn((datos) => {
      guardadas.push({ ...datos });
      return Promise.resolve({ id: datos.id ?? 999, ...datos });
    }),
  };
  const kardex = {
    create: vi.fn((datos) => datos),
    save: vi.fn((datos) => {
      movimientos.push(datos);
      return Promise.resolve(datos);
    }),
  };
  const transferenciaTx = {
    create: vi.fn((datos) => datos),
    save: vi.fn((datos) => Promise.resolve({ id: 77, ...datos })),
  };
  const manager = {
    getRepository: (entidad: unknown) =>
      entidad === Inventario ? inventarioTx : entidad === MovimientoInventario ? kardex : entidad === TransferenciaInventario ? transferenciaTx : undefined,
  };
  const dataSource = { transaction: vi.fn((cb: (m: typeof manager) => unknown) => cb(manager)) };

  const almacenRepo = { find: vi.fn().mockResolvedValue(opciones.almacenes ?? [ORIGEN, DESTINO]) };
  const varianteRepo = { findOne: vi.fn().mockResolvedValue(opciones.variante === undefined ? VARIANTE : opciones.variante) };
  const productoSucursalRepo = {
    findOne: vi.fn().mockResolvedValue(opciones.productoActivo === undefined ? { idProducto: 5, idSucursal: 3, activo: true } : opciones.productoActivo),
  };
  const transferenciaRepo = {
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue({
      id: 77,
      idAlmacenOrigen: 1,
      idAlmacenDestino: 2,
      idVarianteProducto: 10,
      cantidad: 4,
      motivo: 'Reponer vitrina',
      idUsuario: 9,
      fechaHora: new Date(2026, 10, 7),
      almacenOrigen: { nombre: 'Deposito Central', sucursal: { nombre: 'Centro' } },
      almacenDestino: { nombre: 'Tienda Norte', sucursal: { nombre: 'Norte' } },
      variante: { sku: 'SKU-1', producto: { nombre: 'Camisa' } },
    }),
  };

  const service = new TransferenciasService(
    dataSource as never,
    almacenRepo as never,
    varianteRepo as never,
    productoSucursalRepo as never,
    transferenciaRepo as never,
    { empresaId: () => 1 } as never,
  );
  return { service, movimientos, guardadas, inventarioTx, transferenciaTx, transferenciaRepo, almacenRepo, dataSource };
}

describe('TransferenciasService.transferir', () => {
  it('mueve el stock, guarda la transferencia y deja salida y entrada en el kardex', async () => {
    const { service, movimientos, guardadas, transferenciaTx, transferenciaRepo } = crearService();

    const respuesta = await service.transferir(dto(), usuario);

    expect(guardadas.map((g) => [g.idAlmacen, g.stockDisponible])).toEqual([
      [1, 6],
      [2, 7],
    ]);
    expect(transferenciaTx.save).toHaveBeenCalledWith(
      expect.objectContaining({ idAlmacenOrigen: 1, idAlmacenDestino: 2, cantidad: 4, motivo: 'Reponer vitrina', idUsuario: 9 }),
    );
    expect(movimientos).toEqual([
      expect.objectContaining({ idAlmacen: 1, tipo: 'TRANSFERENCIA_SALIDA', cantidad: -4, stockResultante: 6, costoUnitario: 40, referenciaTipo: 'TRANSFERENCIA', referenciaId: 77 }),
      expect.objectContaining({ idAlmacen: 2, tipo: 'TRANSFERENCIA_ENTRADA', cantidad: 4, stockResultante: 7, costoUnitario: 40, referenciaTipo: 'TRANSFERENCIA', referenciaId: 77 }),
    ]);
    // La respuesta sale de la empresa actual.
    expect(transferenciaRepo.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 77, idEmpresa: 1 } }));
    expect(respuesta).toMatchObject({ id: 77, sku: 'SKU-1', productoNombre: 'Camisa', almacenDestino: { nombre: 'Tienda Norte', sucursal: 'Norte' } });
  });

  it('bloquea las dos filas en orden de almacen', async () => {
    const { service, inventarioTx } = crearService();
    await service.transferir(dto(), usuario);
    expect(inventarioTx.find).toHaveBeenCalledWith(expect.objectContaining({ order: { idAlmacen: 'ASC' }, lock: { mode: 'pessimistic_write' } }));
  });

  it('abre la fila del destino cuando la variante aun no estaba en ese almacen', async () => {
    const { service, inventarioTx, movimientos } = crearService({ filas: [fila(1, 10)] });

    await service.transferir(dto({ cantidad: 10 }), usuario);

    expect(inventarioTx.create).toHaveBeenCalledWith(
      expect.objectContaining({ idAlmacen: 2, idVarianteProducto: 10, stockDisponible: 0, stockReservado: 0, stockMinimo: 5, stockMaximo: 500 }),
    );
    expect(movimientos.map((m) => [m.idAlmacen, m.stockResultante])).toEqual([
      [1, 0],
      [2, 10],
    ]);
  });

  it('no deja mover mas de lo disponible (lo reservado no cuenta)', async () => {
    const { service, transferenciaTx } = crearService({ filas: [fila(1, 3, 20), fila(2, 0)] });
    await expect(service.transferir(dto({ cantidad: 4 }), usuario)).rejects.toThrow(BadRequestException);
    expect(transferenciaTx.save).not.toHaveBeenCalled();
  });

  it('rechaza si el origen no tiene stock de esa variante', async () => {
    const { service } = crearService({ filas: [] });
    await expect(service.transferir(dto(), usuario)).rejects.toThrow('disponible: 0');
  });

  it('rechaza origen igual a destino sin tocar la base', async () => {
    const { service, almacenRepo } = crearService();
    await expect(service.transferir(dto({ idAlmacenDestino: 1 }), usuario)).rejects.toThrow(BadRequestException);
    expect(almacenRepo.find).not.toHaveBeenCalled();
  });

  it('da 404 si un almacen no es de la empresa', async () => {
    const { service, almacenRepo, dataSource } = crearService({ almacenes: [ORIGEN] });
    await expect(service.transferir(dto(), usuario)).rejects.toThrow(NotFoundException);
    expect(almacenRepo.find).toHaveBeenCalledWith({ where: expect.objectContaining({ idEmpresa: 1 }) });
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rechaza almacenes inactivos', async () => {
    const { service } = crearService({ almacenes: [ORIGEN, { ...DESTINO, activo: false }] });
    await expect(service.transferir(dto(), usuario)).rejects.toThrow(ConflictException);
  });

  it('da 404 si la variante no es de la empresa', async () => {
    const { service } = crearService({ variante: null });
    await expect(service.transferir(dto(), usuario)).rejects.toThrow(NotFoundException);
  });

  it('exige que el producto este activo en la sucursal del destino', async () => {
    const { service, dataSource } = crearService({ productoActivo: null });
    await expect(service.transferir(dto(), usuario)).rejects.toThrow(ConflictException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});

describe('TransferenciasService.listar', () => {
  it('filtra por la empresa actual', async () => {
    const { service, transferenciaRepo } = crearService();
    await service.listar();
    expect(transferenciaRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { idEmpresa: 1 } }));
  });
});
