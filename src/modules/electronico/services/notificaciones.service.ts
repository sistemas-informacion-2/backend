import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type Repository } from 'typeorm';
import { Usuario } from '../../acceso/entities/usuario.entity.js';
import { NotificacionPush } from '../entities/notificacion-push.entity.js';
import { NotificacionRepository } from '../repositories/notificacion.repository.js';
import { toNotificacionResponseDto } from '../mappers/notificacion.mapper.js';
import { renderizarPlantilla } from '../utils/plantilla.util.js';
import { DispositivoPushRepository } from '../repositories/dispositivo-push.repository.js';
import type { RegistrarDispositivoPushDto } from '../dto/dispositivo-push.dto.js';
import { PushService, type MensajePush } from './push.service.js';
import { SuscripcionWebPushRepository } from '../repositories/suscripcion-web-push.repository.js';
import { esEndpointDePush, WebPushService } from './web-push.service.js';
import type { ConfiguracionWebPushDto, RegistrarWebPushDto } from '../dto/web-push.dto.js';
import type { CrearNotificacionDto } from '../dto/crear-notificacion.dto.js';
import type { NotificacionesQueryDto } from '../dto/notificaciones-query.dto.js';
import { TenantContext } from '../../../common/tenant/tenant-context.service.js';
import type {
  DestinatarioResponseDto,
  EnvioNotificacionResponseDto,
  NotificacionResponseDto,
  NotificacionesPaginatedResponseDto,
} from '../dto/notificacion-response.dto.js';

/** Pantalla que abre la app al tocar el push. */
const URL_NOTIFICACIONES = '/cuenta/notificaciones';
/** Pagina que abre el navegador al tocar el aviso: la campana se despliega sola. */
const URL_NOTIFICACIONES_WEB = '/?notificaciones=abiertas';

type NotificacionParaPush = Pick<NotificacionPush, 'id' | 'idUsuario' | 'titulo' | 'mensaje'>;

@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly notificacionRepo: NotificacionRepository,
    @InjectRepository(Usuario) private readonly usuarioRepo: Repository<Usuario>,
    private readonly dispositivoRepo: DispositivoPushRepository,
    private readonly pushService: PushService,
    private readonly suscripcionesWeb: SuscripcionWebPushRepository,
    private readonly webPush: WebPushService,
    private readonly tenant: TenantContext,
  ) {}

  async listar(query: NotificacionesQueryDto): Promise<NotificacionesPaginatedResponseDto> {
    const { items, total } = await this.notificacionRepo.findPage(query);
    return this.paginar(items, total, query);
  }

  async listarMias(idUsuario: number, query: NotificacionesQueryDto): Promise<NotificacionesPaginatedResponseDto> {
    const { items, total } = await this.notificacionRepo.findPage({ ...query, idUsuario });
    return this.paginar(items, total, query);
  }

  async listarDestinatarios(): Promise<DestinatarioResponseDto[]> {
    const clientes = await this.usuarioRepo.find({
      where: { tipoUsuario: 'C', activo: true, idEmpresa: this.tenant.empresaId() },
      select: { id: true, nombre: true, apellido: true, email: true },
      order: { nombre: 'ASC' },
    });

    return clientes.map((cliente) => ({
      id: cliente.id,
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      email: cliente.email,
      etiqueta: `${cliente.nombre} ${cliente.apellido} (${cliente.email})`,
    }));
  }

  async enviar(dto: CrearNotificacionDto): Promise<EnvioNotificacionResponseDto> {
    const difundir = dto.difundirTodos === true;
    if (difundir && dto.idUsuario !== undefined) {
      throw new BadRequestException('Elija un destinatario o difunda a todos los clientes, no ambos');
    }
    if (!difundir && dto.idUsuario === undefined) {
      throw new BadRequestException('Indique un destinatario o difunda a todos los clientes');
    }

    const titulo = dto.titulo.trim();
    const mensaje = dto.mensaje.trim();

    if (difundir) {
      const clientes = await this.usuarioRepo.find({
        where: { tipoUsuario: 'C', activo: true, idEmpresa: this.tenant.empresaId() },
        select: { id: true, nombre: true, apellido: true, email: true },
      });
      if (clientes.length === 0) return { cantidadEnviada: 0 };

      const filas = clientes.map((cliente) =>
        this.notificacionRepo.create({
          idUsuario: cliente.id,
          titulo,
          mensaje: renderizarPlantilla(mensaje, {
            nombre: cliente.nombre,
            apellido: cliente.apellido,
            email: cliente.email,
          }),
          leido: false,
        }),
      );

      await this.dataSource.transaction(async (manager) => {
        await manager.insert(NotificacionPush, filas);
      });
      // insert completa el id de cada fila (RETURNING); el push lleva ese id para que la app la marque como leida.
      this.notificarPorPush(filas);
      return { cantidadEnviada: filas.length };
    }

    const usuario = await this.usuarioRepo.findOne({ where: { id: dto.idUsuario, idEmpresa: this.tenant.empresaId() } });
    if (!usuario || !usuario.activo) throw new NotFoundException('Usuario destinatario no encontrado');

    const notificacion = this.notificacionRepo.create({
      idUsuario: usuario.id,
      titulo,
      mensaje: renderizarPlantilla(mensaje, {
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
      }),
      leido: false,
    });
    const guardada = await this.notificacionRepo.save(notificacion);
    this.notificarPorPush([guardada]);

    return { cantidadEnviada: 1 };
  }

  async marcarLeido(idUsuario: number, id: number): Promise<NotificacionResponseDto> {
    const notificacion = await this.notificacionRepo.findMiaById(id, idUsuario);
    if (!notificacion) throw new NotFoundException('Notificacion no encontrada');

    if (!notificacion.leido) {
      notificacion.leido = true;
      await this.notificacionRepo.save(notificacion);
    }

    return toNotificacionResponseDto(notificacion);
  }

  async marcarTodasLeidas(idUsuario: number): Promise<{ cantidadActualizada: number }> {
    const cantidadActualizada = await this.notificacionRepo.marcarTodasLeidas(idUsuario);
    return { cantidadActualizada };
  }

  async contarNoLeidas(idUsuario: number): Promise<{ noLeidas: number }> {
    const noLeidas = await this.notificacionRepo.contarNoLeidas(idUsuario);
    return { noLeidas };
  }

  async eliminar(id: number): Promise<void> {
    const notificacion = await this.notificacionRepo.findById(id);
    if (!notificacion) throw new NotFoundException('Notificacion no encontrada');
    await this.notificacionRepo.delete(id);
  }

  /**
   * Avisa por push (celular y navegador) notificaciones ya guardadas. Corre en segundo plano: quien notifica no
   * espera a los servicios push ni falla si fallan (la notificacion ya esta en BD y se ve al abrir la app).
   */
  notificarPorPush(notificaciones: NotificacionParaPush[]): void {
    void Promise.all([this.enviarPush(notificaciones), this.enviarWebPush(notificaciones)]).catch((error: unknown) => {
      this.logger.error(`No se pudo preparar el push: ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  private async enviarPush(notificaciones: NotificacionParaPush[]): Promise<void> {
    if (notificaciones.length === 0) return;

    const idsUsuario = [...new Set(notificaciones.map((notificacion) => notificacion.idUsuario))];
    const dispositivos = await this.dispositivoRepo.listarActivosDeUsuarios(idsUsuario);
    if (dispositivos.length === 0) return;

    const tokensPorUsuario = new Map<number, string[]>();
    for (const { idUsuario, token } of dispositivos) {
      tokensPorUsuario.set(idUsuario, [...(tokensPorUsuario.get(idUsuario) ?? []), token]);
    }

    const mensajes: MensajePush[] = notificaciones.flatMap((notificacion) =>
      (tokensPorUsuario.get(notificacion.idUsuario) ?? []).map((token) => ({
        token,
        titulo: notificacion.titulo,
        mensaje: notificacion.mensaje,
        data: { url: URL_NOTIFICACIONES, idNotificacion: notificacion.id },
      })),
    );
    await this.pushService.enviar(mensajes);
  }

  private async enviarWebPush(notificaciones: NotificacionParaPush[]): Promise<void> {
    if (notificaciones.length === 0 || !this.webPush.habilitado) return;
    const suscripciones = await this.suscripcionesWeb.listarDeUsuarios([...new Set(notificaciones.map((notificacion) => notificacion.idUsuario))]);
    await this.webPush.enviar(
      notificaciones.flatMap((notificacion) =>
        suscripciones
          .filter((suscripcion) => suscripcion.idUsuario === notificacion.idUsuario)
          .map((suscripcion) => ({
            suscripcion,
            titulo: notificacion.titulo,
            mensaje: notificacion.mensaje,
            url: URL_NOTIFICACIONES_WEB,
            etiqueta: `notificacion-${notificacion.id}`,
          })),
      ),
    );
  }

  configuracionWebPush(): ConfiguracionWebPushDto {
    return { habilitado: this.webPush.habilitado, clavePublica: this.webPush.clavePublica };
  }

  async registrarWebPush(idUsuario: number, dto: RegistrarWebPushDto): Promise<void> {
    if (!esEndpointDePush(dto.endpoint)) throw new BadRequestException('La direccion de notificaciones no es valida');
    await this.suscripcionesWeb.registrar(idUsuario, dto.endpoint, dto.keys.p256dh, dto.keys.auth);
  }

  async darDeBajaWebPush(idUsuario: number, endpoint: string): Promise<void> {
    await this.suscripcionesWeb.eliminar(endpoint, idUsuario);
  }

  /** Aviso de prueba a los navegadores del usuario; no se guarda como notificacion. */
  async probarWebPush(idUsuario: number): Promise<{ enviados: number }> {
    const suscripciones = await this.suscripcionesWeb.listarDeUsuarios([idUsuario]);
    const enviados = await this.webPush.enviar(
      suscripciones.map((suscripcion) => ({
        suscripcion,
        titulo: 'FashionStore',
        mensaje: 'Las notificaciones están activas en este dispositivo.',
        url: '/',
        // Etiqueta distinta cada vez: con la misma, el navegador reemplaza el aviso sin volver a alertar.
        etiqueta: `prueba-${Date.now()}`,
      })),
    );
    return { enviados };
  }

  async registrarDispositivo(idUsuario: number, dto: RegistrarDispositivoPushDto): Promise<void> {
    await this.dispositivoRepo.registrar(idUsuario, dto.token, dto.plataforma);
  }

  async darDeBajaDispositivo(idUsuario: number, token: string): Promise<void> {
    await this.dispositivoRepo.desactivarPorToken(token, idUsuario);
  }

  private paginar(
    items: NotificacionPush[],
    total: number,
    query: NotificacionesQueryDto,
  ): NotificacionesPaginatedResponseDto {
    return {
      items: items.map(toNotificacionResponseDto),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }
}
