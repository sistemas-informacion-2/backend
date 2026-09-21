import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { MovimientoCaja } from '../entities/movimiento-caja.entity.js';

@Injectable()
export class MovimientoCajaRepository {
  constructor(@InjectRepository(MovimientoCaja) private readonly repo: Repository<MovimientoCaja>) {}

  findByCaja(idCaja: number): Promise<MovimientoCaja[]> {
    return this.repo.find({ where: { idCaja }, order: { id: 'ASC' } });
  }

  create(datos: Partial<MovimientoCaja>, manager: EntityManager = this.repo.manager): MovimientoCaja {
    return manager.getRepository(MovimientoCaja).create(datos);
  }

  save(movimiento: MovimientoCaja, manager: EntityManager = this.repo.manager): Promise<MovimientoCaja> {
    return manager.getRepository(MovimientoCaja).save(movimiento);
  }
}
