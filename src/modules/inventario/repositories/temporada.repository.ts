import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { Temporada } from '../entities/temporada.entity.js';

@Injectable()
export class TemporadaRepository {
  constructor(@InjectRepository(Temporada) private readonly repo: Repository<Temporada>) {}

  findAll(): Promise<Temporada[]> {
    return this.repo.find({ order: { fechaInicio: 'DESC' } });
  }

  findAllConCategorias(): Promise<Temporada[]> {
    return this.repo.find({
      relations: { temporadasCategoria: { categoria: true } },
      order: { fechaInicio: 'DESC' },
    });
  }

  findById(id: number): Promise<Temporada | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByIds(ids: number[]): Promise<Temporada[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.repo.find({ where: { id: In(ids) } });
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
