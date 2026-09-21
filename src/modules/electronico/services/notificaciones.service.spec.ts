import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { NotificacionesService } from './notificaciones.service.js';
import type { Usuario } from '../../acceso/entities/usuario.entity.js';

function usuarioBase(overrides: Partial<Usuario> = {}): Usuario {
  return {
    id: 1,
    nombre: 'Ana',
    apellido: 'Gomez',
    email: 'ana@example.com',
    telefono: null,
    passwordHash: 'hash',
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

function crearService(overrides: {
  notificacionRepo?: Record<string, ReturnType<typeof vi.fn>>;
  usuarioRepo?: Record<string, ReturnType<typeof vi.fn>>;
  insert?: ReturnType<typeof vi.fn>;
} = {}) {
  const notificacionRepo = {
    findPage: vi.fn(),
    findMiaById: vi.fn(),
    findById: vi.fn(),
    marcarTodasLeidas: vi.fn(),
    contarNoLeidas: vi.fn(),
    create: vi.fn((datos) => datos),
    save: vi.fn((datos) => Promise.resolve(datos)),
    delete: vi.fn(),
    ...overrides.notificacionRepo,
  };
  const usuarioRepo = {
    findOne: vi.fn(),
    find: vi.fn(),
    ...overrides.usuarioRepo,
  };
  const insert = overrides.insert ?? vi.fn().mockResolvedValue(undefined);
  const manager = { insert };
  const dataSource = {
    transaction: vi.fn(async (callback: (manager: object) => unknown) => callback(manager)),
  } as unknown as DataSource;

  return {
    service: new NotificacionesService(dataSource, notificacionRepo as never, usuarioRepo as never),
    notificacionRepo,
    usuarioRepo,
    insert,
  };
}

describe('NotificacionesService', () => {
  it('envia una notificacion individual reemplazando las variables del mensaje', async () => {
    const { service, notificacionRepo } = crearService({
      usuarioRepo: { findOne: vi.fn().mockResolvedValue(usuarioBase()) },
    });

    const resultado = await service.enviar({
      titulo: 'Tu pedido',
      mensaje: 'Hola {{nombre}}, tu pedido esta listo',
      idUsuario: 1,
    });

    expect(resultado.cantidadEnviada).toBe(1);
    expect(notificacionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ idUsuario: 1, mensaje: 'Hola Ana, tu pedido esta listo', leido: false }),
    );
    expect(notificacionRepo.save).toHaveBeenCalled();
  });

  it('rechaza el envio si no se indica destinatario ni difusion', async () => {
    const { service } = crearService();

    await expect(service.enviar({ titulo: 'Aviso', mensaje: 'Hola' })).rejects.toThrow(BadRequestException);
  });

  it('rechaza el envio si se indica destinatario y difusion a la vez', async () => {
    const { service } = crearService();

    await expect(
      service.enviar({ titulo: 'Aviso', mensaje: 'Hola', idUsuario: 1, difundirTodos: true }),
    ).rejects.toThrow(BadRequestException);
  });

  it('difunde a todos los clientes creando una fila por destinatario', async () => {
    const clientes = [
      usuarioBase({ id: 1, nombre: 'Ana', apellido: 'Gomez' }),
      usuarioBase({ id: 2, nombre: 'Luis', apellido: 'Perez', email: 'luis@example.com' }),
    ];
    const { service, insert, usuarioRepo } = crearService({
      usuarioRepo: { find: vi.fn().mockResolvedValue(clientes) },
    });

    const resultado = await service.enviar({
      titulo: 'Promo',
      mensaje: 'Hola {{nombre}}, 20% de descuento',
      difundirTodos: true,
    });

    expect(usuarioRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tipoUsuario: 'C', activo: true } }),
    );
    expect(resultado.cantidadEnviada).toBe(2);
    const filas = insert.mock.calls[0][1] as Array<{ mensaje: string }>;
    expect(filas).toHaveLength(2);
    expect(filas[0].mensaje).toBe('Hola Ana, 20% de descuento');
    expect(filas[1].mensaje).toBe('Hola Luis, 20% de descuento');
  });

  it('no permite marcar como leida una notificacion de otro usuario', async () => {
    const { service, notificacionRepo } = crearService({
      notificacionRepo: { findMiaById: vi.fn().mockResolvedValue(null) },
    });

    await expect(service.marcarLeido(1, 99)).rejects.toThrow(NotFoundException);
    expect(notificacionRepo.save).not.toHaveBeenCalled();
  });
});
