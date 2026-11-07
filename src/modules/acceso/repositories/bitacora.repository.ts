import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Bitacora } from '../entities/bitacora.entity.js';
import { TenantContext } from '../../../common/tenant/tenant-context.service.js';

export interface BitacoraQuery {
  page: number;
  limit: number;
  usuarioId?: number;
  tablaAfectada?: string;
  operacion?: string;
  fechaDesde?: string;
  fechaHasta?: string;
}

@Injectable()
export class BitacoraRepository {
  constructor(
    @InjectRepository(Bitacora) private readonly repo: Repository<Bitacora>,
    private readonly tenant: TenantContext,
  ) {}

  registrar(datos: Partial<Bitacora>): Promise<Bitacora> {
    return this.repo.save(this.repo.create(datos));
  }

  async listar(query: BitacoraQuery): Promise<{ items: Bitacora[]; total: number }> {
    const builder = this.repo
      .createQueryBuilder('bitacora')
      .leftJoinAndSelect('bitacora.usuario', 'usuario')
      .where('bitacora.id_empresa = :idEmpresa', { idEmpresa: this.tenant.empresaId() })
      .orderBy('bitacora.fecha_hora', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    if (query.usuarioId !== undefined) builder.andWhere('bitacora.id_usuario = :usuarioId', { usuarioId: query.usuarioId });
    if (query.tablaAfectada?.trim()) {
      builder.andWhere('LOWER(bitacora.tabla_afectada) LIKE :tablaAfectada', {
        tablaAfectada: `%${query.tablaAfectada.trim().toLowerCase()}%`,
      });
    }
    if (query.operacion) builder.andWhere('bitacora.accion LIKE :operacion', { operacion: `${query.operacion}%` });
    if (query.fechaDesde) builder.andWhere('bitacora.fecha_hora >= :fechaDesde', { fechaDesde: `${query.fechaDesde} 00:00:00` });
    if (query.fechaHasta) builder.andWhere('bitacora.fecha_hora <= :fechaHasta', { fechaHasta: `${query.fechaHasta} 23:59:59.999` });

    const [items, total] = await builder.getManyAndCount();
    return { items, total };
  }

  obtenerPorId(id: string): Promise<Bitacora | null> {
    return this.repo.findOne({ where: { id, idEmpresa: this.tenant.empresaId() }, relations: { usuario: true } });
  }
}
