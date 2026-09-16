import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Cliente } from '../entities/cliente.entity.js';

@Injectable()
export class ClienteRepository {
  constructor(@InjectRepository(Cliente) private readonly repo: Repository<Cliente>) {}

  findByUsuarioId(idUsuario: number): Promise<Cliente | null> {
    return this.repo.findOne({ where: { idUsuario } });
  }
}
