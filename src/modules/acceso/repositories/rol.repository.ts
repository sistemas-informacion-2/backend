import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type EntityManager, type Repository } from 'typeorm';
import { Rol } from '../entities/rol.entity.js';

@Injectable()
export class RolRepository {
  constructor(@InjectRepository(Rol) private readonly repo: Repository<Rol>) {}

  findActive(manager: EntityManager = this.repo.manager): Promise<Rol[]> {
    return manager.getRepository(Rol).find({ where: { activo: true }, order: { nombre: 'ASC' } });
  }

  findActiveByIds(ids: number[], manager: EntityManager = this.repo.manager): Promise<Rol[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return manager.getRepository(Rol).find({ where: { id: In(ids), activo: true } });
  }
}
