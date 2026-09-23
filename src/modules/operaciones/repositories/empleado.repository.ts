import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, type EntityManager, type Repository } from 'typeorm';
import { Empleado } from '../entities/empleado.entity.js';

@Injectable()
export class EmpleadoRepository {
  constructor(@InjectRepository(Empleado) private readonly repo: Repository<Empleado>) {}

  findByUsuarioIdConDatos(
    idUsuario: number,
    manager: EntityManager = this.repo.manager,
  ): Promise<Empleado | null> {
    return manager
      .getRepository(Empleado)
      .createQueryBuilder('empleado')
      .leftJoinAndSelect('empleado.usuario', 'usuario')
      .leftJoinAndSelect('empleado.asignacionesSucursal', 'asignacion')
      .leftJoinAndSelect('asignacion.sucursal', 'sucursal')
      .where('empleado.id_usuario = :idUsuario', { idUsuario })
      .getOne();
  }

  async findPage(
    query: {
      page: number;
      limit: number;
      search?: string;
      idSucursal?: number;
      activo?: boolean;
    },
    manager: EntityManager = this.repo.manager,
  ): Promise<{ items: Empleado[]; total: number }> {
    const builder = manager
      .getRepository(Empleado)
      .createQueryBuilder('empleado')
      .leftJoinAndSelect('empleado.usuario', 'usuario')
      .leftJoinAndSelect('empleado.asignacionesSucursal', 'asignacion')
      .leftJoinAndSelect('asignacion.sucursal', 'sucursal')
      .where('usuario.tipo_usuario = :tipoUsuario', { tipoUsuario: 'E' })
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
            .orWhere('LOWER(usuario.email) LIKE :search', { search })
            .orWhere('LOWER(empleado.codigo_empleado) LIKE :search', { search });
        }),
      );
    }
    if (query.idSucursal !== undefined) {
      builder.andWhere(
        `empleado.id_usuario IN (SELECT es.id_empleado FROM empleado_sucursal es WHERE es.id_sucursal = :idSucursal AND es.activo = true)`,
        { idSucursal: query.idSucursal },
      );
    }
    if (query.activo !== undefined) builder.andWhere('usuario.activo = :activo', { activo: query.activo });

    const [items, total] = await builder.getManyAndCount();
    return { items, total };
  }

  create(datos: Partial<Empleado>, manager: EntityManager = this.repo.manager): Empleado {
    return manager.getRepository(Empleado).create(datos);
  }

  save(empleado: Empleado, manager: EntityManager = this.repo.manager): Promise<Empleado> {
    return manager.getRepository(Empleado).save(empleado);
  }
}
