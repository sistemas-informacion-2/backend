import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, type EntityManager, type Repository } from 'typeorm';
import { Cliente } from '../entities/cliente.entity.js';

@Injectable()
export class ClienteRepository {
  constructor(@InjectRepository(Cliente) private readonly repo: Repository<Cliente>) {}

  findByUsuarioId(
    idUsuario: number,
    manager: EntityManager = this.repo.manager,
  ): Promise<Cliente | null> {
    return manager.getRepository(Cliente).findOne({ where: { idUsuario } });
  }

  findByUsuarioIdConDatos(
    idUsuario: number,
    manager: EntityManager = this.repo.manager,
  ): Promise<Cliente | null> {
    return manager
      .getRepository(Cliente)
      .createQueryBuilder('cliente')
      .leftJoinAndSelect('cliente.usuario', 'usuario')
      .where('cliente.id_usuario = :idUsuario', { idUsuario })
      .getOne();
  }

  async findPage(
    query: {
      page: number;
      limit: number;
      search?: string;
      activo?: boolean;
    },
    manager: EntityManager = this.repo.manager,
  ): Promise<{ items: Cliente[]; total: number }> {
    const builder = manager
      .getRepository(Cliente)
      .createQueryBuilder('cliente')
      .leftJoinAndSelect('cliente.usuario', 'usuario')
      .where("usuario.tipo_usuario = :tipoUsuario", { tipoUsuario: 'C' })
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
    if (query.activo !== undefined) builder.andWhere('usuario.activo = :activo', { activo: query.activo });

    const [items, total] = await builder.getManyAndCount();
    return { items, total };
  }

  create(datos: Partial<Cliente>, manager: EntityManager = this.repo.manager): Cliente {
    return manager.getRepository(Cliente).create(datos);
  }

  save(cliente: Cliente, manager: EntityManager = this.repo.manager): Promise<Cliente> {
    return manager.getRepository(Cliente).save(cliente);
  }
}
