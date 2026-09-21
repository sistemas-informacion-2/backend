import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, type Repository } from 'typeorm';
import { Inventario } from '../entities/inventario.entity.js';

interface FiltrosInventario {
  page: number;
  limit: number;
  idAlmacen?: number;
  idSucursal?: number;
  idVarianteProducto?: number;
  search?: string;
  bajoMinimo?: boolean;
}

@Injectable()
export class InventarioRepository {
  constructor(@InjectRepository(Inventario) private readonly repo: Repository<Inventario>) {}

  async findPage(query: FiltrosInventario): Promise<{ items: Inventario[]; total: number }> {
    const builder = this.repo
      .createQueryBuilder('inventario')
      .leftJoinAndSelect('inventario.almacen', 'almacen')
      .leftJoinAndSelect('almacen.sucursal', 'sucursal')
      .leftJoinAndSelect('inventario.variante', 'variante')
      .leftJoinAndSelect('variante.producto', 'producto')
      .orderBy('inventario.id', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    if (query.idAlmacen !== undefined) builder.andWhere('inventario.id_almacen = :idAlmacen', { idAlmacen: query.idAlmacen });
    if (query.idSucursal !== undefined) builder.andWhere('almacen.id_sucursal = :idSucursal', { idSucursal: query.idSucursal });
    if (query.idVarianteProducto !== undefined) {
      builder.andWhere('inventario.id_variante_producto = :idVarianteProducto', {
        idVarianteProducto: query.idVarianteProducto,
      });
    }
    if (query.search?.trim()) {
      const search = `%${query.search.trim().toLowerCase()}%`;
      builder.andWhere(
        new Brackets((where) => {
          where
            .where('LOWER(variante.sku) LIKE :search', { search })
            .orWhere('LOWER(producto.nombre) LIKE :search', { search });
        }),
      );
    }
    if (query.bajoMinimo) builder.andWhere('inventario.stock_disponible <= inventario.stock_minimo');

    const [items, total] = await builder.getManyAndCount();
    return { items, total };
  }

  findByIdConDetalle(id: number): Promise<Inventario | null> {
    return this.repo
      .createQueryBuilder('inventario')
      .leftJoinAndSelect('inventario.almacen', 'almacen')
      .leftJoinAndSelect('almacen.sucursal', 'sucursal')
      .leftJoinAndSelect('inventario.variante', 'variante')
      .leftJoinAndSelect('variante.producto', 'producto')
      .where('inventario.id = :id', { id })
      .getOne();
  }

  findByAlmacenYVariante(idAlmacen: number, idVarianteProducto: number): Promise<Inventario | null> {
    return this.repo.findOne({ where: { idAlmacen, idVarianteProducto } });
  }

  create(datos: Partial<Inventario>): Inventario {
    return this.repo.create(datos);
  }

  save(inventario: Inventario): Promise<Inventario> {
    return this.repo.save(inventario);
  }
}
