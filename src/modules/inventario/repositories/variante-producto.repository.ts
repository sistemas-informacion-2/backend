import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type EntityManager, type Repository } from 'typeorm';
import { VarianteProducto } from '../entities/variante-producto.entity.js';

@Injectable()
export class VarianteProductoRepository {
  constructor(@InjectRepository(VarianteProducto) private readonly repo: Repository<VarianteProducto>) {}

  findById(id: number, manager: EntityManager = this.repo.manager): Promise<VarianteProducto | null> {
    return manager.getRepository(VarianteProducto).findOne({ where: { id } });
  }

  findBySkus(skus: string[], manager: EntityManager = this.repo.manager): Promise<VarianteProducto[]> {
    if (skus.length === 0) return Promise.resolve([]);
    return manager.getRepository(VarianteProducto).find({ where: { sku: In(skus) } });
  }

  create(datos: Partial<VarianteProducto>, manager: EntityManager = this.repo.manager): VarianteProducto {
    return manager.getRepository(VarianteProducto).create(datos);
  }

  save(variante: VarianteProducto, manager: EntityManager = this.repo.manager): Promise<VarianteProducto> {
    return manager.getRepository(VarianteProducto).save(variante);
  }

  saveMuchas(variantes: VarianteProducto[], manager: EntityManager = this.repo.manager): Promise<VarianteProducto[]> {
    return manager.getRepository(VarianteProducto).save(variantes);
  }

  eliminar(id: number, manager: EntityManager = this.repo.manager): Promise<void> {
    return manager.getRepository(VarianteProducto).delete(id).then(() => undefined);
  }
}
