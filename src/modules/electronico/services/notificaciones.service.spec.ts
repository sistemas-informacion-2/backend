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
  dispositivoRepo?: Record<string, ReturnType<typeof vi.fn>>;
  pushService?: Record<string, ReturnType<typeof vi.fn>>;
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
  const dispositivoRepo = {
    registrar: vi.fn().mockResolvedValue(undefined),
    desactivarPorToken: vi.fn().mockResolvedValue(undefined),
    listarActivosDeUsuarios: vi.fn().mockResolvedValue([]),
    ...overrides.dispositivoRepo,
  };
  const pushService = {
    enviar: vi.fn().mockResolvedValue(undefined),
    ...overrides.pushService,
  };
  const insert = overrides.insert ?? vi.fn().mockResolvedValue(undefined);
  const manager = { insert };
  const dataSource = {
    transaction: vi.fn(async (callback: (manager: object) => unknown) => callback(manager)),
  } as unknown as DataSource;

  return {
    service: new NotificacionesService(dataSource, notificacionRepo as never, usuarioRepo as never, dispositivoRepo as never, pushService as never),
    notificacionRepo,
    usuarioRepo,
    dispositivoRepo,
    pushService,
    insert,
  };
}

/** notificarPorPush corre en segundo plano: esto deja terminar sus promesas pendientes. */
const esperarSegundoPlano = () => new Promise((resolve) => setTimeout(resolve, 0));

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

  describe('dispositivos', () => {
    it('registra el celular a nombre del usuario autenticado', async () => {
      const { service, dispositivoRepo } = crearService();

      await service.registrarDispositivo(7, { token: 'ExponentPushToken[abc]', plataforma: 'android' });

      expect(dispositivoRepo.registrar).toHaveBeenCalledWith(7, 'ExponentPushToken[abc]', 'android');
    });

    it('da de baja el token solo para el usuario autenticado', async () => {
      const { service, dispositivoRepo } = crearService();

      await service.darDeBajaDispositivo(7, 'ExponentPushToken[abc]');

      expect(dispositivoRepo.desactivarPorToken).toHaveBeenCalledWith('ExponentPushToken[abc]', 7);
    });
  });

  describe('push', () => {
    it('al enviar a un usuario manda el push con el texto ya renderizado y el id guardado', async () => {
      const { service, pushService } = crearService({
        usuarioRepo: { findOne: vi.fn().mockResolvedValue(usuarioBase()) },
        notificacionRepo: { save: vi.fn(async (datos) => ({ ...datos, id: 55 })) },
        dispositivoRepo: { listarActivosDeUsuarios: vi.fn().mockResolvedValue([{ idUsuario: 1, token: 'ExponentPushToken[a]' }]) },
      });

      await service.enviar({ titulo: 'Tu pedido', mensaje: 'Hola {{nombre}}, tu pedido esta listo', idUsuario: 1 });
      await esperarSegundoPlano();

      expect(pushService.enviar).toHaveBeenCalledWith([
        {
          token: 'ExponentPushToken[a]',
          titulo: 'Tu pedido',
          mensaje: 'Hola Ana, tu pedido esta listo',
          data: { url: '/cuenta/notificaciones', idNotificacion: 55 },
        },
      ]);
    });

    it('en la difusion solo avisa a quienes tienen celular, a cada token una vez', async () => {
      const clientes = [
        usuarioBase({ id: 1, nombre: 'Ana' }),
        usuarioBase({ id: 2, nombre: 'Luis', email: 'luis@example.com' }),
      ];
      const insert = vi.fn(async (_entidad: unknown, filas: Array<{ id?: number }>) => {
        filas.forEach((fila, indice) => {
          fila.id = 100 + indice;
        });
      });
      const listarActivosDeUsuarios = vi.fn().mockResolvedValue([
        { idUsuario: 1, token: 'ExponentPushToken[ana-1]' },
        { idUsuario: 1, token: 'ExponentPushToken[ana-2]' },
      ]);
      const { service, pushService } = crearService({
        usuarioRepo: { find: vi.fn().mockResolvedValue(clientes) },
        dispositivoRepo: { listarActivosDeUsuarios },
        insert,
      });

      await service.enviar({ titulo: 'Promo', mensaje: 'Hola {{nombre}}', difundirTodos: true });
      await esperarSegundoPlano();

      expect(listarActivosDeUsuarios).toHaveBeenCalledWith([1, 2]);
      const mensajes = pushService.enviar.mock.calls[0][0] as Array<{ token: string; mensaje: string; data: { idNotificacion: number } }>;
      expect(mensajes).toHaveLength(2);
      expect(mensajes.map((m) => m.token)).toEqual(['ExponentPushToken[ana-1]', 'ExponentPushToken[ana-2]']);
      expect(mensajes.every((m) => m.mensaje === 'Hola Ana' && m.data.idNotificacion === 100)).toBe(true);
    });

    it('sin celulares registrados no llama a Expo', async () => {
      const { service, pushService } = crearService({
        usuarioRepo: { findOne: vi.fn().mockResolvedValue(usuarioBase()) },
      });

      await service.enviar({ titulo: 'Aviso', mensaje: 'Hola', idUsuario: 1 });
      await esperarSegundoPlano();

      expect(pushService.enviar).not.toHaveBeenCalled();
    });

    it('enviar() responde sin esperar a Expo aunque el push nunca termine', async () => {
      const { service } = crearService({
        usuarioRepo: { findOne: vi.fn().mockResolvedValue(usuarioBase()) },
        dispositivoRepo: { listarActivosDeUsuarios: vi.fn().mockResolvedValue([{ idUsuario: 1, token: 'ExponentPushToken[a]' }]) },
        pushService: { enviar: vi.fn(() => new Promise(() => undefined)) },
      });

      await expect(service.enviar({ titulo: 'Aviso', mensaje: 'Hola', idUsuario: 1 })).resolves.toEqual({ cantidadEnviada: 1 });
    });

    it('si falla la consulta de tokens, enviar() responde igual y no queda un rechazo sin atender', async () => {
      const { service, pushService } = crearService({
        usuarioRepo: { findOne: vi.fn().mockResolvedValue(usuarioBase()) },
        dispositivoRepo: { listarActivosDeUsuarios: vi.fn().mockRejectedValue(new Error('BD caida')) },
      });

      await expect(service.enviar({ titulo: 'Aviso', mensaje: 'Hola', idUsuario: 1 })).resolves.toEqual({ cantidadEnviada: 1 });
      await esperarSegundoPlano();

      expect(pushService.enviar).not.toHaveBeenCalled();
    });
  });
});
