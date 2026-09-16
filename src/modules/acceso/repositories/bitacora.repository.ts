import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Bitacora } from '../entities/bitacora.entity.js';

@Injectable()
export class BitacoraRepository {
  constructor(@InjectRepository(Bitacora) private readonly repo: Repository<Bitacora>) {}

  registrar(datos: Partial<Bitacora>): Promise<Bitacora> {
    return this.repo.save(this.repo.create(datos));
  }
}
