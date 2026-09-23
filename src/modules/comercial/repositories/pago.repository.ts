import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { Pago } from '../entities/pago.entity.js';

@Injectable()
export class PagoRepository {
  constructor(@InjectRepository(Pago) private readonly repo: Repository<Pago>) {}

  create(datos: Partial<Pago>, manager: EntityManager = this.repo.manager): Pago {
    return manager.getRepository(Pago).create(datos);
  }

  save(pago: Pago, manager: EntityManager = this.repo.manager): Promise<Pago> {
    return manager.getRepository(Pago).save(pago);
  }
}
