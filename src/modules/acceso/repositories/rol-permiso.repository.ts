import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { RolPermiso } from '../entities/rol-permiso.entity.js';

@Injectable()
export class RolPermisoRepository {
  constructor(@InjectRepository(RolPermiso) private readonly repo: Repository<RolPermiso>) {}

  async reemplazarPermisos(
    idRol: number,
    idsPermiso: number[],
    manager: EntityManager = this.repo.manager,
  ): Promise<void> {
    const repository = manager.getRepository(RolPermiso);
    const existentes = await repository.find({ where: { idRol } });
    const deseados = new Set(idsPermiso);
    const existentesIds = new Set<number>();

    for (const relacion of existentes) {
      existentesIds.add(relacion.idPermiso);
      relacion.activo = deseados.has(relacion.idPermiso);
    }

    const nuevos = idsPermiso
      .filter((idPermiso) => !existentesIds.has(idPermiso))
      .map((idPermiso) => repository.create({ idRol, idPermiso, activo: true }));

    if (existentes.length > 0) await repository.save(existentes);
    if (nuevos.length > 0) await repository.save(nuevos);
  }
}
