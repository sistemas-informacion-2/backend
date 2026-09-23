import { ConflictException, NotFoundException } from '@nestjs/common';
import { AlmacenesService } from './almacenes.service.js';
import type { Almacen } from '../entities/almacen.entity.js';

function almacenBase(overrides: Partial<Almacen> = {}): Almacen {
  return {
    id: 1,
    idSucursal: 2,
    sucursal: { id: 2, nombre: 'Sucursal Centro' } as never,
    nombre: 'Deposito Central',
    ubicacionFisica: null,
    activo: true,
    inventarios: [],
    ...overrides,
  };
}

function crearService(overrides: {
  almacenRepo?: Record<string, ReturnType<typeof vi.fn>>;
  sucursalRepo?: Record<string, ReturnType<typeof vi.fn>>;
} = {}) {
  const almacenRepo = {
    findWithFilters: vi.fn(),
    findByIdConDetalle: vi.fn(),
    findBySucursalYNombre: vi.fn(),
    create: vi.fn((datos) => datos),
    save: vi.fn((datos) => Promise.resolve(datos)),
    ...overrides.almacenRepo,
  };
  const sucursalRepo = { findOne: vi.fn(), ...overrides.sucursalRepo };

  return {
    service: new AlmacenesService(almacenRepo as never, sucursalRepo as never),
    almacenRepo,
    sucursalRepo,
  };
}

describe('AlmacenesService', () => {
  it('rechaza crear un almacen en una sucursal inexistente', async () => {
    const { service, almacenRepo } = crearService({
      sucursalRepo: { findOne: vi.fn().mockResolvedValue(null) },
    });

    await expect(service.crear({ idSucursal: 99, nombre: 'Deposito' })).rejects.toThrow(NotFoundException);
    expect(almacenRepo.save).not.toHaveBeenCalled();
  });

  it('rechaza un nombre de almacen repetido en la misma sucursal', async () => {
    const { service } = crearService({
      sucursalRepo: { findOne: vi.fn().mockResolvedValue({ id: 2, activo: true }) },
      almacenRepo: { findBySucursalYNombre: vi.fn().mockResolvedValue(almacenBase()) },
    });

    await expect(service.crear({ idSucursal: 2, nombre: 'Deposito Central' })).rejects.toThrow(ConflictException);
  });

  it('rechaza crear un almacen en una sucursal inactiva', async () => {
    const { service, almacenRepo } = crearService({
      sucursalRepo: { findOne: vi.fn().mockResolvedValue({ id: 2, activo: false }) },
    });

    await expect(service.crear({ idSucursal: 2, nombre: 'Deposito' })).rejects.toThrow(ConflictException);
    expect(almacenRepo.save).not.toHaveBeenCalled();
  });

  it('crea un almacen correctamente', async () => {
    const almacen = almacenBase();
    const { service } = crearService({
      sucursalRepo: { findOne: vi.fn().mockResolvedValue({ id: 2, activo: true }) },
      almacenRepo: {
        findBySucursalYNombre: vi.fn().mockResolvedValue(null),
        save: vi.fn().mockResolvedValue(almacen),
        findByIdConDetalle: vi.fn().mockResolvedValue(almacen),
      },
    });

    const response = await service.crear({ idSucursal: 2, nombre: ' Deposito Central ' });

    expect(response.nombre).toBe('Deposito Central');
    expect(response.cantidadVariantes).toBe(0);
  });
});
