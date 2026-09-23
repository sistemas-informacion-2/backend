import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { ImagenProducto } from '../entities/imagen-producto.entity.js';

@Injectable()
export class ImagenProductoRepository {
  constructor(@InjectRepository(ImagenProducto) private readonly repo: Repository<ImagenProducto>) {}

  findById(id: number, manager: EntityManager = this.repo.manager): Promise<ImagenProducto | null> {
    return manager.getRepository(ImagenProducto).findOne({ where: { id } });
  }

  contarPorProducto(idProducto: number, manager: EntityManager = this.repo.manager): Promise<number> {
    return manager.getRepository(ImagenProducto).count({ where: { idProducto } });
  }

  async desmarcarPrincipales(idProducto: number, manager: EntityManager = this.repo.manager): Promise<void> {
    await manager
      .getRepository(ImagenProducto)
      .createQueryBuilder()
      .update()
      .set({ esPrincipal: false })
      .where('id_producto = :idProducto', { idProducto })
      .execute();
  }

  create(datos: Partial<ImagenProducto>, manager: EntityManager = this.repo.manager): ImagenProducto {
    return manager.getRepository(ImagenProducto).create(datos);
  }

  save(imagen: ImagenProducto, manager: EntityManager = this.repo.manager): Promise<ImagenProducto> {
    return manager.getRepository(ImagenProducto).save(imagen);
  }

  saveMuchas(imagenes: ImagenProducto[], manager: EntityManager = this.repo.manager): Promise<ImagenProducto[]> {
    return manager.getRepository(ImagenProducto).save(imagenes);
  }

  remove(imagen: ImagenProducto, manager: EntityManager = this.repo.manager): Promise<ImagenProducto> {
    return manager.getRepository(ImagenProducto).remove(imagen);
  }
}
