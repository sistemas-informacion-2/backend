import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, type EntityManager, type Repository } from 'typeorm';
import { Producto } from '../entities/producto.entity.js';

const RELACIONES_DETALLE = {
  categoria: true,
  productoSucursales: { sucursal: true },
  imagenes: true,
  variantes: true,
} as const;

interface FiltrosProducto {
  search?: string;
  idCategoria?: number;
  idSucursal?: number;
  idTemporada?: number;
  soloOfertas?: boolean;
  activo?: boolean;
}

@Injectable()
export class ProductoRepository {
  constructor(@InjectRepository(Producto) private readonly repo: Repository<Producto>) {}

  /** Lista simple para el catálogo público: solo activos, sin paginación. */
  findActivos(filtros: { search?: string; idCategoria?: number; idTemporada?: number; soloOfertas?: boolean }): Promise<Producto[]> {
    const builder = this.aplicarFiltros(this.crearBuilder(), { ...filtros, activo: true }, true);
    return builder.orderBy('producto.id', 'DESC').getMany();
  }

  /**
   * Lista paginada para el panel admin. Se pagina sobre IDs primero porque los
   * joins a imagenes/variantes (uno-a-muchos) duplicarian filas y romperian
   * skip/take si se pagina directamente sobre el query con joins.
   */
  async findPage(query: FiltrosProducto & { page: number; limit: number }): Promise<{ items: Producto[]; total: number }> {
    const baseBuilder = this.aplicarFiltros(
      this.repo.createQueryBuilder('producto').leftJoin('producto.categoria', 'categoria'),
      query,
    );

    const total = await baseBuilder.getCount();
    if (total === 0) return { items: [], total: 0 };

    const filas = await baseBuilder
      .select('producto.id', 'id')
      .orderBy('producto.id', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getRawMany<{ id: number }>();

    const ids = filas.map((fila) => fila.id);
    if (ids.length === 0) return { items: [], total };

    const items = await this.repo
      .createQueryBuilder('producto')
      .leftJoinAndSelect('producto.categoria', 'categoria')
      .leftJoinAndSelect('producto.productoSucursales', 'productoSucursal')
      .leftJoinAndSelect('productoSucursal.sucursal', 'sucursal')
      .leftJoinAndSelect('producto.imagenes', 'imagen')
      .leftJoinAndSelect('producto.variantes', 'variante')
      .where('producto.id IN (:...ids)', { ids })
      .orderBy('producto.id', 'DESC')
      .getMany();

    return { items, total };
  }

  findById(id: number, manager: EntityManager = this.repo.manager): Promise<Producto | null> {
    return manager.getRepository(Producto).findOne({ where: { id } });
  }

  findByIdConDetalle(id: number, manager: EntityManager = this.repo.manager): Promise<Producto | null> {
    return manager.getRepository(Producto).findOne({ where: { id }, relations: RELACIONES_DETALLE });
  }

  create(datos: Partial<Producto>, manager: EntityManager = this.repo.manager): Producto {
    return manager.getRepository(Producto).create(datos);
  }

  save(producto: Producto, manager: EntityManager = this.repo.manager): Promise<Producto> {
    return manager.getRepository(Producto).save(producto);
  }

  private crearBuilder() {
    return this.repo
      .createQueryBuilder('producto')
      .leftJoinAndSelect('producto.categoria', 'categoria')
      .leftJoinAndSelect('producto.productoSucursales', 'productoSucursal')
      .leftJoinAndSelect('productoSucursal.sucursal', 'sucursal')
      .leftJoinAndSelect('producto.imagenes', 'imagen')
      .leftJoinAndSelect('producto.variantes', 'variante');
  }

  private aplicarFiltros<T extends { andWhere: any }>(builder: T, filtros: FiltrosProducto, incluirSubcategorias = false): T {
    if (filtros.search?.trim()) {
      const search = `%${filtros.search.trim().toLowerCase()}%`;
      builder.andWhere(
        new Brackets((where: any) => {
          where
            .where('LOWER(producto.nombre) LIKE :search', { search })
            .orWhere('LOWER(producto.descripcion) LIKE :search', { search })
            .orWhere('LOWER(categoria.nombre) LIKE :search', { search });
        }),
      );
    }
    if (filtros.idCategoria !== undefined && incluirSubcategorias) {
      builder.andWhere(
        `producto.id_categoria IN (
          WITH RECURSIVE arbol AS (
            SELECT id FROM categoria WHERE id = :idCategoria
            UNION ALL
            SELECT c.id FROM categoria c JOIN arbol a ON c.id_categoria_padre = a.id
          )
          SELECT id FROM arbol
        )`,
        { idCategoria: filtros.idCategoria },
      );
    } else if (filtros.idCategoria !== undefined) {
      builder.andWhere('producto.id_categoria = :idCategoria', { idCategoria: filtros.idCategoria });
    }
    if (filtros.idSucursal !== undefined) {
      builder.andWhere(
        `producto.id IN (SELECT ps.id_producto FROM producto_sucursal ps WHERE ps.id_sucursal = :idSucursal AND ps.activo = true)`,
        { idSucursal: filtros.idSucursal },
      );
    }
    if (filtros.activo !== undefined) {
      builder.andWhere('producto.activo = :activo', { activo: filtros.activo });
    }
    if (filtros.soloOfertas) {
      builder.andWhere('producto.descuento_porcentaje > 0');
    }
    if (filtros.idTemporada !== undefined) {
      builder.andWhere(
        `producto.id_categoria IN (SELECT tc.id_categoria FROM temporada_categoria tc WHERE tc.id_temporada = :idTemporada)`,
        { idTemporada: filtros.idTemporada },
      );
    }
    return builder;
  }
}
