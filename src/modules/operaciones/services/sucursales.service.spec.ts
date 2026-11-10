import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SucursalesService } from './sucursales.service.js';

function sucursalBase(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    idCiudad: 1,
    nombre: 'Central',
    telefono: null,
    correo: null,
    horarioApertura: null,
    horarioCierre: null,
    ubicacion: 'Av. Principal',
    activo: true,
    ciudad: { id: 1, nombre: 'Santa Cruz', departamento: { id: 1, nombre: 'Santa Cruz' } },
    ...overrides,
  };
}

function crearService(overrides: {
  sucursalRepo?: Record<string, ReturnType<typeof vi.fn>>;
  cajaRepo?: Record<string, ReturnType<typeof vi.fn>>;
  limites?: { verificar: ReturnType<typeof vi.fn> };
} = {}) {
  const sucursalRepo = {
    findByIdConUbicacion: vi.fn().mockResolvedValue(sucursalBase()),
    create: vi.fn((datos) => ({ id: 2, ...datos })),
    save: vi.fn((datos) => Promise.resolve(datos)),
    ...overrides.sucursalRepo,
  };
  const cajaRepo = { count: vi.fn().mockResolvedValue(0), ...overrides.cajaRepo };
  const limites = overrides.limites ?? { verificar: vi.fn().mockResolvedValue(undefined) };
  const ciudadRepo = { findById: vi.fn().mockResolvedValue({ id: 1 }) };

  return {
    service: new SucursalesService(sucursalRepo as never, ciudadRepo as never, cajaRepo as never, limites as never),
    sucursalRepo,
    cajaRepo,
    limites,
  };
}

const limiteSuperado = () => ({ verificar: vi.fn().mockRejectedValue(new ForbiddenException('Tu plan permite hasta 1 sucursal activa')) });

describe('SucursalesService', () => {
  it('rechaza desactivar una sucursal que tiene una caja abierta', async () => {
    const { service, sucursalRepo, cajaRepo } = crearService({
      cajaRepo: { count: vi.fn().mockResolvedValue(1) },
    });

    await expect(service.actualizar(1, { activo: false })).rejects.toThrow(ConflictException);
    expect(cajaRepo.count).toHaveBeenCalledWith({ where: { idSucursal: 1, estado: 'Abierta' } });
    expect(sucursalRepo.save).not.toHaveBeenCalled();
  });

  it('desactiva la sucursal cuando no tiene cajas abiertas', async () => {
    const { service, sucursalRepo } = crearService();

    await service.actualizar(1, { activo: false });

    expect(sucursalRepo.save).toHaveBeenCalledWith(expect.objectContaining({ activo: false }));
  });

  it('no consulta cajas si el cambio no es una desactivacion', async () => {
    const { service, cajaRepo } = crearService();

    await service.actualizar(1, { nombre: 'Central 2' });

    expect(cajaRepo.count).not.toHaveBeenCalled();
  });

  it('rechaza actualizar una sucursal inexistente', async () => {
    const { service } = crearService({
      sucursalRepo: { findByIdConUbicacion: vi.fn().mockResolvedValue(null) },
    });

    await expect(service.actualizar(9, { activo: false })).rejects.toThrow(NotFoundException);
  });

  it('no crea una sucursal si el plan ya llego a su limite', async () => {
    const { service, sucursalRepo, limites } = crearService({ limites: limiteSuperado() });

    await expect(service.crear({ idCiudad: 1, nombre: 'Norte', ubicacion: 'Av. Banzer' })).rejects.toThrow(ForbiddenException);
    expect(limites.verificar).toHaveBeenCalledWith('sucursales');
    expect(sucursalRepo.save).not.toHaveBeenCalled();
  });

  it('reactivar una sucursal cuenta para el limite del plan; editarla no', async () => {
    const inactiva = crearService({
      sucursalRepo: { findByIdConUbicacion: vi.fn().mockResolvedValue(sucursalBase({ activo: false })) },
      limites: limiteSuperado(),
    });
    await expect(inactiva.service.actualizar(1, { activo: true })).rejects.toThrow(ForbiddenException);
    expect(inactiva.sucursalRepo.save).not.toHaveBeenCalled();

    const activa = crearService();
    await activa.service.actualizar(1, { nombre: 'Central 2' });
    expect(activa.limites.verificar).not.toHaveBeenCalled();
  });
});
