import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, type Repository } from 'typeorm';
import { Almacen } from '../entities/almacen.entity.js';

@Injectable()
export class AlmacenRepository {
  constructor(@InjectRepository(Almacen) private readonly repo: Repository<Almacen>) {}

  findWithFilters(query: { search?: string; idSucursal?: number; activo?: boolean }): Promise<Almacen[]> {
    const builder = this.repo
      .createQueryBuilder('almacen')
      .leftJoinAndSelect('almacen.sucursal', 'sucursal')
      .leftJoinAndSelect('almacen.inventarios', 'inventario')
      .orderBy('almacen.nombre', 'ASC');

    if (query.search?.trim()) {
      const search = `%${query.search.trim().toLowerCase()}%`;
      builder.andWhere(
        new Brackets((where) => {
          where
            .where('LOWER(almacen.nombre) LIKE :search', { search })
            .orWhere('LOWER(almacen.ubicacion_fisica) LIKE :search', { search });
        }),
      );
    }
    if (query.idSucursal !== undefined) builder.andWhere('almacen.id_sucursal = :idSucursal', { idSucursal: query.idSucursal });
    if (query.activo !== undefined) builder.andWhere('almacen.activo = :activo', { activo: query.activo });

    return builder.getMany();
  }

  findByIdConDetalle(id: number): Promise<Almacen | null> {
    return this.repo
      .createQueryBuilder('almacen')
      .leftJoinAndSelect('almacen.sucursal', 'sucursal')
      .leftJoinAndSelect('almacen.inventarios', 'inventario')
      .where('almacen.id = :id', { id })
      .getOne();
  }

  findBySucursalYNombre(idSucursal: number, nombre: string): Promise<Almacen | null> {
    return this.repo
      .createQueryBuilder('almacen')
      .where('almacen.id_sucursal = :idSucursal', { idSucursal })
      .andWhere('LOWER(almacen.nombre) = :nombre', { nombre: nombre.trim().toLowerCase() })
      .getOne();
  }

  create(datos: Partial<Almacen>): Almacen {
    return this.repo.create(datos);
  }

  save(almacen: Almacen): Promise<Almacen> {
    return this.repo.save(almacen);
  }
}
