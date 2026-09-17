import { Injectable } from '@nestjs/common';
import { PermisoRepository } from '../repositories/permiso.repository.js';
import { toPermisosAgrupados } from '../mappers/rol.mapper.js';

@Injectable()
export class PermisosService {
  constructor(private readonly permisoRepo: PermisoRepository) {}

  async listarAgrupados() {
    const permisos = await this.permisoRepo.findActive();
    return toPermisosAgrupados(permisos);
  }
}
