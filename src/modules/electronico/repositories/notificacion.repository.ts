import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, type EntityManager, type Repository } from 'typeorm';
import { NotificacionPush } from '../entities/notificacion-push.entity.js';

interface FiltrosNotificacion {
  page: number;
  limit: number;
  idUsuario?: number;
  leido?: boolean;
  search?: string;
  fechaDesde?: string;
  fechaHasta?: string;
}

@Injectable()
export class NotificacionRepository {
  constructor(@InjectRepository(NotificacionPush) private readonly repo: Repository<NotificacionPush>) {}

  async findPage(
    query: FiltrosNotificacion,
    manager: EntityManager = this.repo.manager,
  ): Promise<{ items: NotificacionPush[]; total: number }> {
    const builder = manager
      .getRepository(NotificacionPush)
      .createQueryBuilder('notificacion')
      .leftJoinAndSelect('notificacion.usuario', 'usuario')
      .orderBy('notificacion.fecha_envio', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    if (query.idUsuario !== undefined) {
      builder.andWhere('notificacion.id_usuario = :idUsuario', { idUsuario: query.idUsuario });
    }
    if (query.leido !== undefined) builder.andWhere('notificacion.leido = :leido', { leido: query.leido });
    if (query.search?.trim()) {
      const search = `%${query.search.trim().toLowerCase()}%`;
      builder.andWhere(
        new Brackets((where) => {
          where
            .where('LOWER(notificacion.titulo) LIKE :search', { search })
            .orWhere('LOWER(notificacion.mensaje) LIKE :search', { search });
        }),
      );
    }
    if (query.fechaDesde) builder.andWhere('notificacion.fecha_envio >= :fechaDesde', { fechaDesde: query.fechaDesde });
    if (query.fechaHasta) builder.andWhere('notificacion.fecha_envio <= :fechaHasta', { fechaHasta: query.fechaHasta });

    const [items, total] = await builder.getManyAndCount();
    return { items, total };
  }

  findMiaById(id: number, idUsuario: number): Promise<NotificacionPush | null> {
    return this.repo
      .createQueryBuilder('notificacion')
      .leftJoinAndSelect('notificacion.usuario', 'usuario')
      .where('notificacion.id = :id', { id })
      .andWhere('notificacion.id_usuario = :idUsuario', { idUsuario })
      .getOne();
  }

  findById(id: number): Promise<NotificacionPush | null> {
    return this.repo.findOne({ where: { id } });
  }

  async marcarTodasLeidas(idUsuario: number): Promise<number> {
    const resultado = await this.repo.update({ idUsuario, leido: false }, { leido: true });
    return resultado.affected ?? 0;
  }

  contarNoLeidas(idUsuario: number): Promise<number> {
    return this.repo.count({ where: { idUsuario, leido: false } });
  }

  create(datos: Partial<NotificacionPush>): NotificacionPush {
    return this.repo.create(datos);
  }

  save(notificacion: NotificacionPush): Promise<NotificacionPush> {
    return this.repo.save(notificacion);
  }

  delete(id: number): Promise<unknown> {
    return this.repo.delete(id);
  }
}
