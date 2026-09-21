import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type Repository } from 'typeorm';
import { Usuario } from '../../acceso/entities/usuario.entity.js';
import { NotificacionPush } from '../entities/notificacion-push.entity.js';
import { NotificacionRepository } from '../repositories/notificacion.repository.js';
import { toNotificacionResponseDto } from '../mappers/notificacion.mapper.js';
import { renderizarPlantilla } from '../utils/plantilla.util.js';
import type { CrearNotificacionDto } from '../dto/crear-notificacion.dto.js';
import type { NotificacionesQueryDto } from '../dto/notificaciones-query.dto.js';
import type {
  DestinatarioResponseDto,
  EnvioNotificacionResponseDto,
  NotificacionResponseDto,
  NotificacionesPaginatedResponseDto,
} from '../dto/notificacion-response.dto.js';

@Injectable()
export class NotificacionesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly notificacionRepo: NotificacionRepository,
    @InjectRepository(Usuario) private readonly usuarioRepo: Repository<Usuario>,
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
      where: { tipoUsuario: 'C', activo: true },
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
        where: { tipoUsuario: 'C', activo: true },
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
      return { cantidadEnviada: filas.length };
    }

    const usuario = await this.usuarioRepo.findOne({ where: { id: dto.idUsuario } });
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
    await this.notificacionRepo.save(notificacion);

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
