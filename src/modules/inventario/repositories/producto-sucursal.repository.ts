import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { ProductoSucursal } from '../entities/producto-sucursal.entity.js';

@Injectable()
export class ProductoSucursalRepository {
  constructor(
    @InjectRepository(ProductoSucursal) private readonly repo: Repository<ProductoSucursal>,
  ) {}

  async reemplazarSucursales(
    idProducto: number,
    idsSucursal: number[],
    manager: EntityManager = this.repo.manager,
  ): Promise<void> {
    const repository = manager.getRepository(ProductoSucursal);
    const existentes = await repository.find({ where: { idProducto } });
    const deseados = new Set(idsSucursal);
    const existentesIds = new Set(
      existentes.filter((relacion) => relacion.activo).map((relacion) => relacion.idSucursal),
    );

    const aEliminar = existentes.filter(
      (relacion) => !relacion.activo || !deseados.has(relacion.idSucursal),
    );
    const aCrear = idsSucursal
      .filter((idSucursal) => !existentesIds.has(idSucursal))
      .map((idSucursal) => [idProducto, idSucursal]);

    if (aEliminar.length > 0) await repository.remove(aEliminar);
    for (const [productoId, sucursalId] of aCrear) {
      await manager.query(
        `INSERT INTO producto_sucursal (id_producto, id_sucursal, activo)
         VALUES ($1, $2, TRUE)
         ON CONFLICT (id_producto, id_sucursal) DO NOTHING`,
        [productoId, sucursalId],
      );
    }
  }
}
