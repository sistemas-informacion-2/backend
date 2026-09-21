import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InventarioService } from './inventario.service.js';
import type { Inventario } from '../entities/inventario.entity.js';

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
} = {}) {
  const inventarioRepo = {
    findPage: vi.fn(),
    findByIdConDetalle: vi.fn(),
    findByAlmacenYVariante: vi.fn(),
    create: vi.fn((datos) => datos),
    save: vi.fn((datos) => Promise.resolve(datos)),
    ...overrides.inventarioRepo,
  };
  const almacenRepo = { findOne: vi.fn(), ...overrides.almacenRepo };
  const varianteRepo = { findOne: vi.fn(), ...overrides.varianteRepo };

  return {
    service: new InventarioService(inventarioRepo as never, almacenRepo as never, varianteRepo as never),
    inventarioRepo,
    almacenRepo,
    varianteRepo,
  };
}

describe('InventarioService', () => {
  it('registra una variante nueva en un almacen', async () => {
    const inventario = inventarioBase();
    const { service, inventarioRepo } = crearService({
      almacenRepo: { findOne: vi.fn().mockResolvedValue({ id: 1 }) },
      varianteRepo: { findOne: vi.fn().mockResolvedValue({ id: 10 }) },
      inventarioRepo: {
        findByAlmacenYVariante: vi.fn().mockResolvedValue(null),
        save: vi.fn().mockResolvedValue(inventario),
        findByIdConDetalle: vi.fn().mockResolvedValue(inventario),
      },
    });

    const response = await service.registrar({ idAlmacen: 1, idVarianteProducto: 10, stockDisponible: 3 });

    expect(inventarioRepo.findByAlmacenYVariante).toHaveBeenCalledWith(1, 10);
    expect(response.id).toBe(1);
    expect(response.bajoMinimo).toBe(true);
  });

  it('rechaza registrar dos veces la misma variante en el mismo almacen', async () => {
    const { service } = crearService({
      almacenRepo: { findOne: vi.fn().mockResolvedValue({ id: 1 }) },
      varianteRepo: { findOne: vi.fn().mockResolvedValue({ id: 10 }) },
      inventarioRepo: { findByAlmacenYVariante: vi.fn().mockResolvedValue(inventarioBase()) },
    });

    await expect(service.registrar({ idAlmacen: 1, idVarianteProducto: 10 })).rejects.toThrow(ConflictException);
  });

  it('rechaza registrar si el almacen no existe', async () => {
    const { service, inventarioRepo } = crearService({
      almacenRepo: { findOne: vi.fn().mockResolvedValue(null) },
    });

    await expect(service.registrar({ idAlmacen: 99, idVarianteProducto: 10 })).rejects.toThrow(NotFoundException);
    expect(inventarioRepo.save).not.toHaveBeenCalled();
  });

  it('una salida no puede dejar el stock en negativo', async () => {
    const { service, inventarioRepo } = crearService({
      inventarioRepo: { findByIdConDetalle: vi.fn().mockResolvedValue(inventarioBase({ stockDisponible: 3 })) },
    });

    await expect(service.ajustar(1, { tipo: 'SALIDA', cantidad: 5 })).rejects.toThrow(BadRequestException);
    expect(inventarioRepo.save).not.toHaveBeenCalled();
  });

  it('una entrada incrementa el stock disponible', async () => {
    const inventario = inventarioBase({ stockDisponible: 3 });
    const { service, inventarioRepo } = crearService({
      inventarioRepo: {
        findByIdConDetalle: vi.fn().mockResolvedValue(inventario),
        save: vi.fn().mockResolvedValue(inventario),
      },
    });

    await service.ajustar(1, { tipo: 'ENTRADA', cantidad: 2 });

    expect(inventario.stockDisponible).toBe(5);
    expect(inventarioRepo.save).toHaveBeenCalledWith(inventario);
  });

  it('un ajuste fija el stock al valor indicado', async () => {
    const inventario = inventarioBase({ stockDisponible: 3 });
    const { service } = crearService({
      inventarioRepo: {
        findByIdConDetalle: vi.fn().mockResolvedValue(inventario),
        save: vi.fn().mockResolvedValue(inventario),
      },
    });

    await service.ajustar(1, { tipo: 'AJUSTE', cantidad: 40 });

    expect(inventario.stockDisponible).toBe(40);
  });
});
