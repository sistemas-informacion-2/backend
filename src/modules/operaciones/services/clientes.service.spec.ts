import * as bcrypt from 'bcrypt';
import type { DataSource } from 'typeorm';
import { ClientesService } from './clientes.service.js';
import type { Cliente } from '../entities/cliente.entity.js';
import type { Usuario } from '../../acceso/entities/usuario.entity.js';

function usuarioBase(overrides: Partial<Usuario> = {}): Usuario {
  return {
    id: 1,
    nombre: 'Carlos',
    apellido: 'Perez',
    email: 'carlos@example.com',
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
    direccionPrincipal: null,
    puntosFidelidad: 0,
    ...overrides,
  };
}

function crearService(overrides: {
  clienteRepo?: Record<string, ReturnType<typeof vi.fn>>;
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
  const clienteRepo = {
    findPage: vi.fn(),
    findByUsuarioIdConDatos: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    ...overrides.clienteRepo,
  };

  return {
    service: new ClientesService(dataSource, clienteRepo as never),
    clienteRepo,
    usuarioRepo,
  };
}

describe('ClientesService', () => {
  it('crea un cliente con cuenta de usuario tipo C y puntos en cero', async () => {
    const usuario = usuarioBase();
    const cliente = clienteBase({ ciudadResidencia: 'Santa Cruz', direccionPrincipal: 'Av. Siempre Viva 123' });
    const { service, clienteRepo, usuarioRepo } = crearService({
      usuarioRepo: {
        findOne: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockReturnValue(usuario),
        save: vi.fn().mockResolvedValue(usuario),
      },
      clienteRepo: {
        create: vi.fn().mockReturnValue(cliente),
        save: vi.fn().mockResolvedValue(cliente),
        findByUsuarioIdConDatos: vi.fn().mockResolvedValue(cliente),
      },
    });

    const response = await service.crear({
      nombre: ' Carlos ',
      apellido: ' Perez ',
      email: ' CARLOS@EXAMPLE.COM ',
      password: 'secreto',
      ciudadResidencia: ' Santa Cruz ',
      direccionPrincipal: ' Av. Siempre Viva 123 ',
    });

    expect(usuarioRepo.findOne).toHaveBeenCalledWith({ where: { email: 'carlos@example.com' } });
    expect(usuarioRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'carlos@example.com', tipoUsuario: 'C', activo: true }),
    );
    const datosUsuario = usuarioRepo.create.mock.calls[0][0] as Usuario;
    await expect(bcrypt.compare('secreto', datosUsuario.passwordHash)).resolves.toBe(true);
    expect(clienteRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ idUsuario: usuario.id, puntosFidelidad: 0, ciudadResidencia: 'Santa Cruz' }),
      expect.anything(),
    );
    expect(response.id).toBe(usuario.id);
    expect(response.puntosFidelidad).toBe(0);
  });

  it('rechaza crear un cliente con email duplicado', async () => {
    const { service, usuarioRepo } = crearService({
      usuarioRepo: { findOne: vi.fn().mockResolvedValue(usuarioBase()) },
    });

    await expect(
      service.crear({ nombre: 'Carlos', apellido: 'Perez', email: 'carlos@example.com', password: 'secreto' }),
    ).rejects.toThrow('El email ya está registrado');

    expect(usuarioRepo.save).not.toHaveBeenCalled();
  });

  it('actualiza datos personales y de residencia del cliente', async () => {
    const usuario = usuarioBase();
    const cliente = clienteBase({ ciudadResidencia: 'La Paz', usuario });
    const { service, clienteRepo, usuarioRepo } = crearService({
      clienteRepo: {
        findByUsuarioIdConDatos: vi.fn().mockResolvedValue(cliente),
        save: vi.fn().mockResolvedValue(cliente),
      },
      usuarioRepo: {
        findOne: vi.fn().mockResolvedValue(null),
        save: vi.fn().mockResolvedValue(usuario),
      },
    });

    await service.actualizar(1, { ciudadResidencia: 'Cochabamba', telefono: '77712345' });

    expect(usuario.telefono).toBe('77712345');
    expect(cliente.ciudadResidencia).toBe('Cochabamba');
    expect(usuarioRepo.save).toHaveBeenCalledWith(usuario);
    expect(clienteRepo.save).toHaveBeenCalledWith(cliente, expect.anything());
  });
});
