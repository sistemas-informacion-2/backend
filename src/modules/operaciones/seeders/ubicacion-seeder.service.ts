import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Departamento } from '../entities/departamento.entity.js';

const DEPARTAMENTOS_BOLIVIA = [
  'Santa Cruz',
  'La Paz',
  'Cochabamba',
  'Beni',
  'Tarija',
  'Oruro',
  'Potosí',
  'Pando',
  'Chuquisaca',
];

/** Siembra los 9 departamentos de Bolivia, referencia fija para crear sucursales/ciudades. Idempotente. */
@Injectable()
export class UbicacionSeederService {
  private readonly logger = new Logger(UbicacionSeederService.name);

  constructor(@InjectRepository(Departamento) private readonly departamentoRepo: Repository<Departamento>) {}

  async run(): Promise<void> {
    for (const nombre of DEPARTAMENTOS_BOLIVIA) {
      const existente = await this.departamentoRepo.findOne({ where: { nombre } });
      if (!existente) {
        await this.departamentoRepo.save(this.departamentoRepo.create({ nombre }));
        this.logger.log(`Departamento creado: ${nombre}`);
      }
    }
  }
}
