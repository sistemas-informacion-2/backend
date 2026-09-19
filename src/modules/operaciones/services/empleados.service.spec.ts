import * as bcrypt from 'bcrypt';
import type { DataSource } from 'typeorm';
import { EmpleadosService } from './empleados.service.js';
import type { Empleado } from '../entities/empleado.entity.js';
import type { Usuario } from '../../acceso/entities/usuario.entity.js';

function usuarioBase(overrides: Partial<Usuario> = {}): Usuario {
  return {
    id: 1,
    nombre: 'Maria',
    apellido: 'Gomez',
    email: 'maria@example.com',
    telefono: null,
    passwordHash: 'hash-anterior',
    sexo: null,
    tipoUsuario: 'E',
    estadoAcceso: 'HABILITADO',
    intentosFallidos: 0,
    fechaCreacion: new Date('2026-01-01T00:00:00.000Z'),
    activo: true,
    rolesUsuario: [],
    sesiones: [],
    ...overrides,
  };
}

function empleadoBase(overrides: Partial<Empleado> = {}): Empleado {
  return {
    idUsuario: 1,
    usuario: usuarioBase(),
    codigoEmpleado: 'EMP-001',
    salario: '2500.00',
    fechaContratacion: '2026-01-15',
    fechaFinalizacion: null,
    asignacionesSucursal: [],
    ...overrides,
  };
}

function crearService(overrides: {
  empleadoRepo?: Record<string, ReturnType<typeof vi.fn>>;
  usuarioRepo?: Record<string, ReturnType<typeof vi.fn>>;
} = {}) {
  const usuarioRepo = {
    findOne: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    ...overrides.usuarioRepo,
  };
  const manager = {
    getRepository: vi.fn().mockReturnValue(usuarioRepo),
  };
  const dataSource = {
    transaction: vi.fn(async (callback: (manager: object) => unknown) => callback(manager)),
  } as unknown as DataSource;
  const empleadoRepo = {
    findPage: vi.fn(),
    findByUsuarioIdConDatos: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    ...overrides.empleadoRepo,
  };

  return {
    service: new EmpleadosService(dataSource, empleadoRepo as never),
    empleadoRepo,
    usuarioRepo,
  };
}

describe('EmpleadosService', () => {
  it('crea un empleado con cuenta de usuario tipo E y código autogenerado', async () => {
    const usuario = usuarioBase();
    const empleado = empleadoBase({ codigoEmpleado: 'EMP-0001', salario: '3000.00' });
    const { service, empleadoRepo, usuarioRepo } = crearService({
      usuarioRepo: {
        findOne: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockReturnValue(usuario),
        save: vi.fn().mockResolvedValue(usuario),
      },
      empleadoRepo: {
        create: vi.fn().mockReturnValue(empleado),
        save: vi.fn().mockResolvedValue(empleado),
        findByUsuarioIdConDatos: vi.fn().mockResolvedValue(empleado),
      },
    });

    const response = await service.crear({
      nombre: ' Maria ',
      apellido: ' Gomez ',
      email: ' MARIA@EXAMPLE.COM ',
      password: 'secreto',
      salario: 3000,
      fechaContratacion: '2026-02-01',
    });

    expect(usuarioRepo.findOne).toHaveBeenCalledWith({ where: { email: 'maria@example.com' } });
    expect(usuarioRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'maria@example.com', tipoUsuario: 'E', activo: true }),
    );
    const datosUsuario = usuarioRepo.create.mock.calls[0][0] as Usuario;
    await expect(bcrypt.compare('secreto', datosUsuario.passwordHash)).resolves.toBe(true);
    expect(empleadoRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ idUsuario: usuario.id, codigoEmpleado: 'EMP-0001', salario: '3000.00' }),
      expect.anything(),
    );
    expect(response.codigoEmpleado).toBe('EMP-0001');
    expect(response.salario).toBe(3000);
  });

  it('rechaza crear un empleado con email duplicado', async () => {
    const { service, usuarioRepo } = crearService({
      usuarioRepo: { findOne: vi.fn().mockResolvedValue(usuarioBase()) },
    });

    await expect(
      service.crear({
        nombre: 'Maria',
        apellido: 'Gomez',
        email: 'maria@example.com',
        password: 'secreto',
        salario: 3000,
        fechaContratacion: '2026-02-01',
      }),
    ).rejects.toThrow('El email ya está registrado');

    expect(usuarioRepo.save).not.toHaveBeenCalled();
  });

  it('actualiza datos laborales del empleado', async () => {
    const usuario = usuarioBase();
    const empleado = empleadoBase({ salario: '2500.00', usuario });
    const { service, empleadoRepo, usuarioRepo } = crearService({
      empleadoRepo: {
        findByUsuarioIdConDatos: vi.fn().mockResolvedValue(empleado),
        save: vi.fn().mockResolvedValue(empleado),
      },
      usuarioRepo: {
        findOne: vi.fn().mockResolvedValue(null),
        save: vi.fn().mockResolvedValue(usuario),
      },
    });

    await service.actualizar(1, { salario: 4100.5, fechaFinalizacion: '2026-12-31' });

    expect(empleado.salario).toBe('4100.50');
    expect(empleado.fechaFinalizacion).toBe('2026-12-31');
    expect(usuarioRepo.save).toHaveBeenCalledWith(usuario);
    expect(empleadoRepo.save).toHaveBeenCalledWith(empleado, expect.anything());
  });
});
