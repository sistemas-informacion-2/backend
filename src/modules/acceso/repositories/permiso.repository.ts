import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type EntityManager, type Repository } from 'typeorm';
import { Permiso } from '../entities/permiso.entity.js';

@Injectable()
export class PermisoRepository {
  constructor(@InjectRepository(Permiso) private readonly repo: Repository<Permiso>) {}

  findAllActivos(manager: EntityManager = this.repo.manager): Promise<Permiso[]> {
    return manager.getRepository(Permiso).find({ where: { activo: true }, order: { accion: 'ASC' } });
  }

  findActiveByIds(ids: number[], manager: EntityManager = this.repo.manager): Promise<Permiso[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return manager.getRepository(Permiso).find({ where: { id: In(ids), activo: true } });
  }
}
