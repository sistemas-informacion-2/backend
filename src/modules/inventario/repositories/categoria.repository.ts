import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Categoria } from '../entities/categoria.entity.js';
import { TenantContext } from '../../../common/tenant/tenant-context.service.js';

const RELACIONES_CON_TEMPORADAS = { temporadasCategoria: { temporada: true } } as const;

@Injectable()
export class CategoriaRepository {
  constructor(
    @InjectRepository(Categoria) private readonly repo: Repository<Categoria>,
    private readonly tenant: TenantContext,
  ) {}

  findAllActivas(): Promise<Categoria[]> {
    return this.repo.find({
      where: { activo: true, idEmpresa: this.tenant.empresaId() },
      relations: RELACIONES_CON_TEMPORADAS,
      order: { nombre: 'ASC' },
    });
  }

  findAll(): Promise<Categoria[]> {
    return this.repo.find({ where: { idEmpresa: this.tenant.empresaId() }, relations: RELACIONES_CON_TEMPORADAS, order: { nombre: 'ASC' } });
  }

  findById(id: number): Promise<Categoria | null> {
    return this.repo.findOne({ where: { id, idEmpresa: this.tenant.empresaId() } });
  }

  findByIdConTemporadas(id: number): Promise<Categoria | null> {
    return this.repo.findOne({ where: { id, idEmpresa: this.tenant.empresaId() }, relations: RELACIONES_CON_TEMPORADAS });
  }

  findBySlug(slug: string): Promise<Categoria | null> {
    return this.repo.findOne({ where: { slug, idEmpresa: this.tenant.empresaId() } });
  }

  create(datos: Partial<Categoria>): Categoria {
    return this.repo.create(datos);
  }

  save(categoria: Categoria): Promise<Categoria> {
    return this.repo.save(categoria);
  }
}
