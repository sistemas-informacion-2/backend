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

  findWithFilters(
    query: { search?: string; activo?: boolean },
    manager: EntityManager = this.repo.manager,
  ): Promise<Rol[]> {
    const builder = manager
      .getRepository(Rol)
      .createQueryBuilder('rol')
      .leftJoinAndSelect('rol.rolesPermiso', 'rolPermiso', 'rolPermiso.activo = true')
      .leftJoinAndSelect('rolPermiso.permiso', 'permiso')
      .orderBy('rol.nombre', 'ASC');

    if (query.search?.trim()) {
      const search = `%${query.search.trim().toLowerCase()}%`;
      builder.andWhere('LOWER(rol.nombre) LIKE :search', { search });
    }
    if (query.activo !== undefined) builder.andWhere('rol.activo = :activo', { activo: query.activo });

    return builder.getMany();
  }

  findByIdConPermisos(id: number, manager: EntityManager = this.repo.manager): Promise<Rol | null> {
    return manager
      .getRepository(Rol)
      .createQueryBuilder('rol')
      .leftJoinAndSelect('rol.rolesPermiso', 'rolPermiso', 'rolPermiso.activo = true')
      .leftJoinAndSelect('rolPermiso.permiso', 'permiso')
      .where('rol.id = :id', { id })
      .getOne();
  }

  findByNombre(nombre: string, manager: EntityManager = this.repo.manager): Promise<Rol | null> {
    return manager.getRepository(Rol).findOne({ where: { nombre } });
  }

  create(datos: Partial<Rol>, manager: EntityManager = this.repo.manager): Rol {
    return manager.getRepository(Rol).create(datos);
  }

  save(rol: Rol, manager: EntityManager = this.repo.manager): Promise<Rol> {
    return manager.getRepository(Rol).save(rol);
  }
}
