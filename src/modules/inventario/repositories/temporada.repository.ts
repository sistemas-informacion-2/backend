import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { Temporada } from '../entities/temporada.entity.js';
import { TenantContext } from '../../../common/tenant/tenant-context.service.js';

@Injectable()
export class TemporadaRepository {
  constructor(
    @InjectRepository(Temporada) private readonly repo: Repository<Temporada>,
    private readonly tenant: TenantContext,
  ) {}

  findAll(): Promise<Temporada[]> {
    return this.repo.find({ where: { idEmpresa: this.tenant.empresaId() }, order: { fechaInicio: 'DESC' } });
  }

  findAllConCategorias(): Promise<Temporada[]> {
    return this.repo.find({
      where: { idEmpresa: this.tenant.empresaId() },
      relations: { temporadasCategoria: { categoria: true } },
      order: { fechaInicio: 'DESC' },
    });
  }

  findById(id: number): Promise<Temporada | null> {
    return this.repo.findOne({ where: { id, idEmpresa: this.tenant.empresaId() } });
  }

  findByIds(ids: number[]): Promise<Temporada[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.repo.find({ where: { id: In(ids), idEmpresa: this.tenant.empresaId() } });
  }

  create(datos: Partial<Temporada>): Temporada {
    return this.repo.create(datos);
  }

  save(temporada: Temporada): Promise<Temporada> {
    return this.repo.save(temporada);
  }

  remove(temporada: Temporada): Promise<Temporada> {
    return this.repo.remove(temporada);
  }
}
