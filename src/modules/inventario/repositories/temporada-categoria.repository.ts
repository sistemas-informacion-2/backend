import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { TemporadaCategoria } from '../entities/temporada-categoria.entity.js';

@Injectable()
export class TemporadaCategoriaRepository {
  constructor(
    @InjectRepository(TemporadaCategoria) private readonly repo: Repository<TemporadaCategoria>,
  ) {}

  async reemplazarTemporadas(idCategoria: number, idsTemporada: number[]): Promise<void> {
    const existentes = await this.repo.find({ where: { idCategoria } });
    const deseados = new Set(idsTemporada);
    const existentesIds = new Set(existentes.map((relacion) => relacion.idTemporada));

    const aEliminar = existentes.filter((relacion) => !deseados.has(relacion.idTemporada));
    const aCrear = idsTemporada
      .filter((idTemporada) => !existentesIds.has(idTemporada))
      .map((idTemporada) => this.repo.create({ idTemporada, idCategoria }));

    if (aEliminar.length > 0) await this.repo.remove(aEliminar);
    if (aCrear.length > 0) await this.repo.save(aCrear);
  }
}
