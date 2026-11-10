import * as bcrypt from 'bcrypt';
import type { DataSource } from 'typeorm';
import { UsuariosService } from './usuarios.service.js';
import type { Usuario } from '../entities/usuario.entity.js';

function usuarioBase(overrides: Partial<Usuario> = {}): Usuario {
  return {
    id: 1,
    nombre: 'Ana',
    apellido: 'Lopez',
    email: 'ana@example.com',
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

describe('UsuariosService', () => {
  it('crea un usuario con email normalizado y contraseña hasheada', async () => {
    const creado = usuarioBase();
    const usuarioRepo = {
      findByEmail: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockReturnValue(creado),
      save: vi.fn().mockResolvedValue(creado),
      findByIdConRolesParaGestion: vi.fn().mockResolvedValue(creado),
    };
    const rolRepo = { findActiveByIds: vi.fn().mockResolvedValue([]) };
    const rolUsuarioRepo = { reemplazarRoles: vi.fn() };
    const sesionRepo = { cerrarAbiertasPorUsuario: vi.fn() };
    const limites = { verificar: vi.fn().mockResolvedValue(undefined) };
    const dataSource = {
      transaction: vi.fn(async (callback: (manager: object) => unknown) => callback({})),
    } as unknown as DataSource;
    const service = new UsuariosService(
      dataSource,
      usuarioRepo as never,
      rolRepo as never,
      rolUsuarioRepo as never,
      sesionRepo as never,
      limites as never,
    );

    const response = await service.crear({
      nombre: ' Ana ',
      apellido: ' Lopez ',
      email: ' ANA@EXAMPLE.COM ',
      password: 'secreto',
      tipoUsuario: 'E',
    });

    expect(usuarioRepo.findByEmail).toHaveBeenCalledWith('ana@example.com', expect.anything());
    expect(usuarioRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ana@example.com', nombre: 'Ana', apellido: 'Lopez' }),
      expect.anything(),
    );
    const datosGuardados = usuarioRepo.create.mock.calls[0][0] as Usuario;
    await expect(bcrypt.compare('secreto', datosGuardados.passwordHash)).resolves.toBe(true);
    expect(response.email).toBe('ana@example.com');
    expect(limites.verificar).toHaveBeenCalledWith('usuarios', expect.anything());
  });

  it('no crea personal si el plan ya llego a su limite de usuarios', async () => {
    const usuarioRepo = { findByEmail: vi.fn().mockResolvedValue(null), create: vi.fn(), save: vi.fn() };
    const limites = { verificar: vi.fn().mockRejectedValue(new Error('Tu plan permite hasta 3 usuarios activos')) };
    const dataSource = {
      transaction: vi.fn(async (callback: (manager: object) => unknown) => callback({})),
    } as unknown as DataSource;
    const service = new UsuariosService(dataSource, usuarioRepo as never, {} as never, {} as never, {} as never, limites as never);

    await expect(
      service.crear({ nombre: 'Luis', apellido: 'Rojas', email: 'luis@example.com', password: 'secreto1', tipoUsuario: 'A' }),
    ).rejects.toThrow('Tu plan permite hasta 3 usuarios activos');
    expect(usuarioRepo.save).not.toHaveBeenCalled();
  });

  it('reactivar a un empleado cuenta para el limite; reactivar a un cliente no', async () => {
    const limites = { verificar: vi.fn().mockResolvedValue(undefined) };
    const dataSource = {
      transaction: vi.fn(async (callback: (manager: object) => unknown) => callback({})),
    } as unknown as DataSource;
    const crear = (usuario: Usuario) =>
      new UsuariosService(
        dataSource,
        { findByIdConRolesParaGestion: vi.fn().mockResolvedValue(usuario), save: vi.fn().mockResolvedValue(usuario) } as never,
        {} as never,
        {} as never,
        { cerrarAbiertasPorUsuario: vi.fn() } as never,
        limites as never,
      );

    await crear(usuarioBase({ activo: false, tipoUsuario: 'C' })).actualizar(1, { activo: true });
    expect(limites.verificar).not.toHaveBeenCalled();

    await crear(usuarioBase({ activo: false, tipoUsuario: 'E' })).actualizar(1, { activo: true });
    expect(limites.verificar).toHaveBeenCalledWith('usuarios', expect.anything());
  });

  it('rechaza crear un usuario con email duplicado', async () => {
    const usuarioRepo = { findByEmail: vi.fn().mockResolvedValue(usuarioBase()) };
    const dataSource = {
      transaction: vi.fn(async (callback: (manager: object) => unknown) => callback({})),
    } as unknown as DataSource;
    const service = new UsuariosService(
      dataSource,
      usuarioRepo as never,
      {} as never,
      {} as never,
      {} as never,
      { verificar: vi.fn() } as never,
    );

    await expect(
      service.crear({
        nombre: 'Otra',
        apellido: 'Persona',
        email: 'ANA@EXAMPLE.COM',
        password: 'secreto',
        tipoUsuario: 'C',
      }),
    ).rejects.toThrow('El email ya está registrado');
  });

  it('desactiva al usuario y cierra sus sesiones', async () => {
    const usuario = usuarioBase();
    const usuarioRepo = {
      findByIdConRolesParaGestion: vi.fn().mockResolvedValue(usuario),
      save: vi.fn().mockResolvedValue(usuario),
    };
    const sesionRepo = { cerrarAbiertasPorUsuario: vi.fn().mockResolvedValue(undefined) };
    const dataSource = {
      transaction: vi.fn(async (callback: (manager: object) => unknown) => callback({})),
    } as unknown as DataSource;
    const service = new UsuariosService(
      dataSource,
      usuarioRepo as never,
      {} as never,
      {} as never,
      sesionRepo as never,
      { verificar: vi.fn() } as never,
    );

    await service.eliminar(1);

    expect(usuario.activo).toBe(false);
    expect(usuario.estadoAcceso).toBe('SUSPENDIDO');
    expect(sesionRepo.cerrarAbiertasPorUsuario).toHaveBeenCalledWith(1, expect.anything());
  });
});
