import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, type EntityManager, type Repository } from 'typeorm';
import { Usuario } from '../entities/usuario.entity.js';

const RELACIONES_CON_PERMISOS = {
  rolesUsuario: { rol: { rolesPermiso: { permiso: true } } },
} as const;

@Injectable()
export class UsuarioRepository {
  constructor(@InjectRepository(Usuario) private readonly repo: Repository<Usuario>) {}

  findByEmailConRoles(email: string): Promise<Usuario | null> {
    return this.repo.findOne({ where: { email }, relations: RELACIONES_CON_PERMISOS });
  }

  findByEmail(email: string, manager: EntityManager = this.repo.manager): Promise<Usuario | null> {
    return manager.getRepository(Usuario).findOne({ where: { email } });
  }

  findByIdConRoles(id: number): Promise<Usuario | null> {
    return this.repo.findOne({ where: { id }, relations: RELACIONES_CON_PERMISOS });
  }

  findById(id: number): Promise<Usuario | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByIdConRolesParaGestion(id: number, manager: EntityManager = this.repo.manager): Promise<Usuario | null> {
    return manager
      .getRepository(Usuario)
      .createQueryBuilder('usuario')
      .leftJoinAndSelect('usuario.rolesUsuario', 'rolUsuario')
      .leftJoinAndSelect('rolUsuario.rol', 'rol')
      .where('usuario.id = :id', { id })
      .getOne();
  }

  async findPage(
    query: {
      page: number;
      limit: number;
      search?: string;
      tipoUsuario?: string;
      estadoAcceso?: string;
      activo?: boolean;
    },
    manager: EntityManager = this.repo.manager,
  ): Promise<{ items: Usuario[]; total: number }> {
    const builder = manager
      .getRepository(Usuario)
      .createQueryBuilder('usuario')
      .leftJoinAndSelect('usuario.rolesUsuario', 'rolUsuario')
      .leftJoinAndSelect('rolUsuario.rol', 'rol')
      .where('1 = 1')
      .andWhere(
        new Brackets((where) => {
          where.where('rolUsuario.activo = :rolActivo', { rolActivo: true }).orWhere('rolUsuario.id_usuario IS NULL');
        }),
      )
      .andWhere(
        new Brackets((where) => {
          where.where('rol.activo = :rolActivo', { rolActivo: true }).orWhere('rol.id IS NULL');
        }),
      )
      .distinct(true)
      .orderBy('usuario.id', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    if (query.search?.trim()) {
      const search = `%${query.search.trim().toLowerCase()}%`;
      builder.andWhere(
        new Brackets((where) => {
          where
            .where('LOWER(usuario.nombre) LIKE :search', { search })
            .orWhere('LOWER(usuario.apellido) LIKE :search', { search })
            .orWhere('LOWER(usuario.email) LIKE :search', { search });
        }),
      );
    }
    if (query.tipoUsuario) builder.andWhere('usuario.tipo_usuario = :tipoUsuario', { tipoUsuario: query.tipoUsuario });
    if (query.estadoAcceso) {
      builder.andWhere('usuario.estado_acceso = :estadoAcceso', { estadoAcceso: query.estadoAcceso });
    }
    if (query.activo !== undefined) builder.andWhere('usuario.activo = :activo', { activo: query.activo });

    const [items, total] = await builder.getManyAndCount();
    return { items, total };
  }

  create(datos: Partial<Usuario>, manager: EntityManager = this.repo.manager): Usuario {
    return manager.getRepository(Usuario).create(datos);
  }

  save(usuario: Usuario, manager: EntityManager = this.repo.manager): Promise<Usuario> {
    return manager.getRepository(Usuario).save(usuario);
  }
}
