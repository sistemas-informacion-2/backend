import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, type EntityManager, type Repository } from 'typeorm';
import { Sesion } from '../entities/sesion.entity.js';

@Injectable()
export class SesionRepository {
  constructor(@InjectRepository(Sesion) private readonly repo: Repository<Sesion>) {}

  crear(datos: Partial<Sesion>): Promise<Sesion> {
    return this.repo.save(this.repo.create(datos));
  }

  /** Sesión abierta y no expirada que coincide con el hash (usado en refresh). */
  findVigentePorHash(idUsuario: number, refreshTokenHash: string): Promise<Sesion | null> {
    return this.repo.findOne({
      where: {
        idUsuario,
        refreshTokenHash,
        fechaCierre: IsNull(),
        fechaExpiracion: MoreThan(new Date()),
      },
    });
  }

  /** Sesión abierta que coincide con el hash, sin importar expiración (usado en logout). */
  findAbiertaPorHash(idUsuario: number, refreshTokenHash: string): Promise<Sesion | null> {
    return this.repo.findOne({
      where: { idUsuario, refreshTokenHash, fechaCierre: IsNull() },
    });
  }

  cerrar(sesion: Sesion): Promise<Sesion> {
    sesion.fechaCierre = new Date();
    return this.repo.save(sesion);
  }

  cerrarAbiertasPorUsuario(idUsuario: number, manager: EntityManager = this.repo.manager): Promise<unknown> {
    return manager.getRepository(Sesion).update(
      { idUsuario, fechaCierre: IsNull() },
      { fechaCierre: new Date() },
    );
  }
}
