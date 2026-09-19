import * as bcrypt from 'bcrypt';
import type { DataSource } from 'typeorm';
import { PerfilService } from './perfil.service.js';
import type { AuthService } from './auth.service.js';
import type { Usuario } from '../entities/usuario.entity.js';
import type { Cliente } from '../../operaciones/entities/cliente.entity.js';
import type { PerfilDto } from '../dto/auth-response.dto.js';
import type { ActiveUser } from '../types/jwt-payload.type.js';

const ACTIVE_USER: ActiveUser = {
  sub: 1,
  tipoUsuario: 'C',
  permisos: [],
  jti: 'test-jti',
};

function usuarioBase(overrides: Partial<Usuario> = {}): Usuario {
  return {
    id: 1,
    nombre: 'Ana',
    apellido: 'Lopez',
    email: 'ana@example.com',
    telefono: null,
    passwordHash: 'hash-anterior',
    sexo: null,
    tipoUsuario: 'C',
    estadoAcceso: 'HABILITADO',
    intentosFallidos: 0,
    fechaCreacion: new Date('2026-01-01T00:00:00.000Z'),
    activo: true,
    rolesUsuario: [],
    sesiones: [],
    ...overrides,
  };
}

function clienteBase(overrides: Partial<Cliente> = {}): Cliente {
  return {
    idUsuario: 1,
    usuario: usuarioBase(),
    ciudadResidencia: null,
    direccionPrincipal: 'Av. Antigua',
    puntosFidelidad: 0,
    ...overrides,
  };
}

function crearService(overrides: {
  authService?: Record<string, ReturnType<typeof vi.fn>>;
  usuarioRepo?: Record<string, ReturnType<typeof vi.fn>>;
  clienteRepo?: Record<string, ReturnType<typeof vi.fn>>;
} = {}) {
  const manager = {};
  const dataSource = {
    transaction: vi.fn(async (callback: (manager: object) => unknown) => callback(manager)),
  } as unknown as DataSource;
  const authService = {
    me: vi.fn(),
    ...overrides.authService,
  };
  const usuarioRepo = {
    findById: vi.fn(),
    save: vi.fn(),
    ...overrides.usuarioRepo,
  };
  const clienteRepo = {
    findByUsuarioId: vi.fn(),
    save: vi.fn(),
    ...overrides.clienteRepo,
  };

  return {
    service: new PerfilService(
      dataSource,
      authService as unknown as AuthService,
      usuarioRepo as never,
      clienteRepo as never,
    ),
    authService,
    usuarioRepo,
    clienteRepo,
  };
}

describe('PerfilService', () => {
  it('delega la obtencion del perfil en AuthService', async () => {
    const perfil = { id: 1, nombre: 'Ana' } as PerfilDto;
    const { service, authService } = crearService({
      authService: { me: vi.fn().mockResolvedValue(perfil) },
    });

    await expect(service.obtener(ACTIVE_USER)).resolves.toBe(perfil);
    expect(authService.me).toHaveBeenCalledWith(ACTIVE_USER);
  });

  it('actualiza la direccion del cliente ademas de los datos base', async () => {
    const usuario = usuarioBase();
    const cliente = clienteBase({ usuario });
    const perfil = { id: 1, nombre: 'Ana', direccion: 'Nueva 456' } as PerfilDto;
    const { service, usuarioRepo, clienteRepo } = crearService({
      authService: { me: vi.fn().mockResolvedValue(perfil) },
      usuarioRepo: {
        findById: vi.fn().mockResolvedValue(usuario),
        save: vi.fn().mockResolvedValue(usuario),
      },
      clienteRepo: {
        findByUsuarioId: vi.fn().mockResolvedValue(cliente),
        save: vi.fn().mockResolvedValue(cliente),
      },
    });

    const response = await service.actualizar(ACTIVE_USER, {
      nombre: ' Ana ',
      telefono: '77712345',
      direccion: ' Nueva 456 ',
    });

    expect(usuario.nombre).toBe('Ana');
    expect(usuario.telefono).toBe('77712345');
    expect(cliente.direccionPrincipal).toBe('Nueva 456');
    expect(usuarioRepo.save).toHaveBeenCalledWith(usuario, expect.anything());
    expect(clienteRepo.save).toHaveBeenCalledWith(cliente, expect.anything());
    expect(response).toBe(perfil);
  });

  it('rechaza el cambio de contraseña si la actual no coincide', async () => {
    const usuario = usuarioBase({ passwordHash: await bcrypt.hash('correcta', 10) });
    const { service, usuarioRepo } = crearService({
      usuarioRepo: { findById: vi.fn().mockResolvedValue(usuario) },
    });

    await expect(
      service.cambiarPassword(ACTIVE_USER, { passwordActual: 'incorrecta', nuevaPassword: 'nueva123' }),
    ).rejects.toThrow('La contraseña actual no es correcta');

    expect(usuarioRepo.save).not.toHaveBeenCalled();
  });

  it('guarda el hash de la nueva contraseña', async () => {
    const usuario = usuarioBase({ passwordHash: await bcrypt.hash('correcta', 10) });
    const { service, usuarioRepo } = crearService({
      usuarioRepo: {
        findById: vi.fn().mockResolvedValue(usuario),
        save: vi.fn().mockResolvedValue(usuario),
      },
    });

    await service.cambiarPassword(ACTIVE_USER, { passwordActual: 'correcta', nuevaPassword: 'nueva123' });

    await expect(bcrypt.compare('nueva123', usuario.passwordHash)).resolves.toBe(true);
    expect(usuarioRepo.save).toHaveBeenCalledWith(usuario);
  });
});
