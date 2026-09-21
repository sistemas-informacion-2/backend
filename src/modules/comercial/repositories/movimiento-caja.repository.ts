import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { MovimientoCaja } from '../entities/movimiento-caja.entity.js';

@Injectable()
export class MovimientoCajaRepository {
  constructor(@InjectRepository(MovimientoCaja) private readonly repo: Repository<MovimientoCaja>) {}

  findByCaja(idCaja: number): Promise<MovimientoCaja[]> {
    return this.repo.find({ where: { idCaja }, order: { id: 'ASC' } });
  }

  create(datos: Partial<MovimientoCaja>): MovimientoCaja {
    return this.repo.create(datos);
  }

  save(movimiento: MovimientoCaja): Promise<MovimientoCaja> {
    return this.repo.save(movimiento);
  }
}
