import type { DataSource } from 'typeorm';
import { RolesService } from './roles.service.js';
import type { Rol } from '../entities/rol.entity.js';

function rolBase(overrides: Partial<Rol> = {}): Rol {
  return {
    id: 1,
    nombre: 'VENDEDOR',
    descripcion: 'Rol de ventas',
    fechaCreacion: new Date('2026-01-01T00:00:00.000Z'),
    activo: true,
    rolesUsuario: [],
    rolesPermiso: [],
    ...overrides,
  };
}

function crearService(overrides: {
  rolRepo?: Record<string, ReturnType<typeof vi.fn>>
  permisoRepo?: Record<string, ReturnType<typeof vi.fn>>
  rolPermisoRepo?: Record<string, ReturnType<typeof vi.fn>>
} = {}) {
  const dataSource = {
    transaction: vi.fn(async (callback: (manager: object) => unknown) => callback({})),
  } as unknown as DataSource;
  const rolRepo = {
    findByName: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    findByIdWithDetails: vi.fn(),
    ...overrides.rolRepo,
  };
  const permisoRepo = {
    findActiveByIds: vi.fn(),
    ...overrides.permisoRepo,
  };
  const rolPermisoRepo = {
    reemplazarPermisos: vi.fn(),
    ...overrides.rolPermisoRepo,
  };

  return {
    service: new RolesService(dataSource, rolRepo as never, permisoRepo as never, rolPermisoRepo as never),
    rolRepo,
    permisoRepo,
    rolPermisoRepo,
  };
}

describe('RolesService', () => {
  it('normaliza y crea un rol', async () => {
    const rol = rolBase();
    const { service, rolRepo } = crearService({
      rolRepo: {
        findByName: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockReturnValue(rol),
        save: vi.fn().mockResolvedValue(rol),
        findByIdWithDetails: vi.fn().mockResolvedValue(rol),
      },
    });

    const response = await service.crear({ nombre: ' vendedor ', descripcion: 'Rol de ventas' });

    expect(rolRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: 'VENDEDOR', descripcion: 'Rol de ventas', activo: true }),
    );
    expect(response.nombre).toBe('VENDEDOR');
  });

  it('reemplaza los permisos dentro de una transaccion', async () => {
    const rol = rolBase();
    const { service, permisoRepo, rolPermisoRepo } = crearService({
      rolRepo: { findByIdWithDetails: vi.fn().mockResolvedValue(rol) },
      permisoRepo: { findActiveByIds: vi.fn().mockResolvedValue([{ id: 1, accion: 'acceso:usuarios:gestionar', activo: true }]) },
    });

    await service.gestionarPermisos(1, { permisos: [1] });

    expect(permisoRepo.findActiveByIds).toHaveBeenCalledWith([1], expect.anything());
    expect(rolPermisoRepo.reemplazarPermisos).toHaveBeenCalledWith(1, [1], expect.anything());
  });

  it('desactiva un rol sin eliminarlo fisicamente', async () => {
    const rol = rolBase();
    const { service, rolRepo } = crearService({
      rolRepo: {
        findByIdWithDetails: vi.fn().mockResolvedValue(rol),
        save: vi.fn().mockResolvedValue(rol),
      },
    });

    await service.eliminar(1);

    expect(rol.activo).toBe(false);
    expect(rolRepo.save).toHaveBeenCalledWith(rol);
  });
});
