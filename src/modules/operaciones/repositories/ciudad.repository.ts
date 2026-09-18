import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Ciudad } from '../entities/ciudad.entity.js';

@Injectable()
export class CiudadRepository {
  constructor(@InjectRepository(Ciudad) private readonly repo: Repository<Ciudad>) {}

  findAllConDepartamento(): Promise<Ciudad[]> {
    return this.repo.find({ relations: { departamento: true }, order: { nombre: 'ASC' } });
  }

  findById(id: number): Promise<Ciudad | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByIdConDepartamento(id: number): Promise<Ciudad | null> {
    return this.repo.findOne({ where: { id }, relations: { departamento: true } });
  }

  create(datos: Partial<Ciudad>): Ciudad {
    return this.repo.create(datos);
  }

  save(ciudad: Ciudad): Promise<Ciudad> {
    return this.repo.save(ciudad);
  }
}
