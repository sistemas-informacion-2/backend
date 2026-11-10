import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type EntityManager, type Repository } from 'typeorm';
import { Rol } from '../entities/rol.entity.js';
import { TenantContext } from '../../../common/tenant/tenant-context.service.js';

@Injectable()
export class RolRepository {
  constructor(
    @InjectRepository(Rol) private readonly repo: Repository<Rol>,
    private readonly tenant: TenantContext,
  ) {}

  async findAll(
    query: { search?: string; activo?: boolean },
    manager: EntityManager = this.repo.manager,
  ): Promise<Rol[]> {
    const builder = manager
      .getRepository(Rol)
      .createQueryBuilder('rol')
      .leftJoinAndSelect('rol.rolesUsuario', 'rolUsuario')
      .leftJoinAndSelect('rolUsuario.usuario', 'usuario')
      .leftJoinAndSelect('rol.rolesPermiso', 'rolPermiso')
      .leftJoinAndSelect('rolPermiso.permiso', 'permiso')
      .where('rol.id_empresa = :idEmpresa', { idEmpresa: this.tenant.empresaId() })
      .orderBy('rol.nombre', 'ASC');

    if (query.search?.trim()) {
      builder.andWhere('LOWER(rol.nombre) LIKE :search', {
        search: `%${query.search.trim().toLowerCase()}%`,
      });
    }
    if (query.activo !== undefined) builder.andWhere('rol.activo = :activo', { activo: query.activo });

    return builder.getMany();
  }

  findByIdWithDetails(id: number, manager: EntityManager = this.repo.manager): Promise<Rol | null> {
    return manager
      .getRepository(Rol)
      .createQueryBuilder('rol')
      .leftJoinAndSelect('rol.rolesUsuario', 'rolUsuario')
      .leftJoinAndSelect('rolUsuario.usuario', 'usuario')
      .leftJoinAndSelect('rol.rolesPermiso', 'rolPermiso')
      .leftJoinAndSelect('rolPermiso.permiso', 'permiso')
      .where('rol.id = :id', { id })
      .andWhere('rol.id_empresa = :idEmpresa', { idEmpresa: this.tenant.empresaId() })
      .getOne();
  }

  findByName(nombre: string, manager: EntityManager = this.repo.manager): Promise<Rol | null> {
    return manager
      .getRepository(Rol)
      .createQueryBuilder('rol')
      .where('LOWER(rol.nombre) = :nombre', { nombre: nombre.trim().toLowerCase() })
      .andWhere('rol.id_empresa = :idEmpresa', { idEmpresa: this.tenant.empresaId() })
      .getOne();
  }

  create(datos: Partial<Rol>, manager: EntityManager = this.repo.manager): Rol {
    return manager.getRepository(Rol).create(datos);
  }

  save(rol: Rol, manager: EntityManager = this.repo.manager): Promise<Rol> {
    return manager.getRepository(Rol).save(rol);
  }

  findActiveByIds(ids: number[], manager: EntityManager = this.repo.manager): Promise<Rol[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return manager.getRepository(Rol).find({ where: { id: In(ids), activo: true, idEmpresa: this.tenant.empresaId() } });
  }
}
