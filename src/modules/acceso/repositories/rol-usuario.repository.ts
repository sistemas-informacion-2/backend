import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { RolUsuario } from '../entities/rol-usuario.entity.js';

@Injectable()
export class RolUsuarioRepository {
  constructor(@InjectRepository(RolUsuario) private readonly repo: Repository<RolUsuario>) {}

  async reemplazarRoles(idUsuario: number, idsRol: number[], manager: EntityManager = this.repo.manager): Promise<void> {
    const repository = manager.getRepository(RolUsuario);
    const existentes = await repository.find({ where: { idUsuario } });
    const deseados = new Set(idsRol);
    const existentesIds = new Set<number>();

    for (const relacion of existentes) {
      existentesIds.add(relacion.idRol);
      relacion.activo = deseados.has(relacion.idRol);
    }

    const nuevos = idsRol
      .filter((idRol) => !existentesIds.has(idRol))
      .map((idRol) => repository.create({ idRol, idUsuario, activo: true }));

    if (existentes.length > 0) await repository.save(existentes);
    if (nuevos.length > 0) await repository.save(nuevos);
  }
}
