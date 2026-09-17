import { Injectable } from '@nestjs/common';
import { RolRepository } from '../repositories/rol.repository.js';

@Injectable()
export class RolesService {
  constructor(private readonly rolRepo: RolRepository) {}

  async listarActivos(): Promise<Array<{ id: number; nombre: string }>> {
    const roles = await this.rolRepo.findActive();
    return roles.map((rol) => ({ id: rol.id, nombre: rol.nombre }));
  }
}
