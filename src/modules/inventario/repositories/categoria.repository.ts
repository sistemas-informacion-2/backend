import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Categoria } from '../entities/categoria.entity.js';

const RELACIONES_CON_TEMPORADAS = { temporadasCategoria: { temporada: true } } as const;

@Injectable()
export class CategoriaRepository {
  constructor(@InjectRepository(Categoria) private readonly repo: Repository<Categoria>) {}

  findAllActivas(): Promise<Categoria[]> {
    return this.repo.find({
      where: { activo: true },
      relations: RELACIONES_CON_TEMPORADAS,
      order: { nombre: 'ASC' },
    });
  }

  findAll(): Promise<Categoria[]> {
    return this.repo.find({ relations: RELACIONES_CON_TEMPORADAS, order: { nombre: 'ASC' } });
  }

  findById(id: number): Promise<Categoria | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByIdConTemporadas(id: number): Promise<Categoria | null> {
    return this.repo.findOne({ where: { id }, relations: RELACIONES_CON_TEMPORADAS });
  }

  findBySlug(slug: string): Promise<Categoria | null> {
    return this.repo.findOne({ where: { slug } });
  }

  create(datos: Partial<Categoria>): Categoria {
    return this.repo.create(datos);
  }

  save(categoria: Categoria): Promise<Categoria> {
    return this.repo.save(categoria);
  }
}
