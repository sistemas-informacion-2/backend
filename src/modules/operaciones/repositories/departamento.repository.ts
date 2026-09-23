import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Departamento } from '../entities/departamento.entity.js';

@Injectable()
export class DepartamentoRepository {
  constructor(@InjectRepository(Departamento) private readonly repo: Repository<Departamento>) {}

  findAll(): Promise<Departamento[]> {
    return this.repo.find({ order: { nombre: 'ASC' } });
  }

  findById(id: number): Promise<Departamento | null> {
    return this.repo.findOne({ where: { id } });
  }
}
