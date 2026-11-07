import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type EntityManager, type Repository } from 'typeorm';
import { VarianteProducto } from '../entities/variante-producto.entity.js';
import { TenantContext } from '../../../common/tenant/tenant-context.service.js';

@Injectable()
export class VarianteProductoRepository {
  constructor(
    @InjectRepository(VarianteProducto) private readonly repo: Repository<VarianteProducto>,
    private readonly tenant: TenantContext,
  ) {}

  findById(id: number, manager: EntityManager = this.repo.manager): Promise<VarianteProducto | null> {
    return manager.getRepository(VarianteProducto).findOne({ where: { id, idEmpresa: this.tenant.empresaId() } });
  }

  findBySkus(skus: string[], manager: EntityManager = this.repo.manager): Promise<VarianteProducto[]> {
    if (skus.length === 0) return Promise.resolve([]);
    return manager.getRepository(VarianteProducto).find({ where: { sku: In(skus), idEmpresa: this.tenant.empresaId() } });
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
