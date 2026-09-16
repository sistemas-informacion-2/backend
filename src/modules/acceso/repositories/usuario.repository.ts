import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Usuario } from '../entities/usuario.entity.js';

const RELACIONES_CON_PERMISOS = {
  rolesUsuario: { rol: { rolesPermiso: { permiso: true } } },
} as const;

@Injectable()
export class UsuarioRepository {
  constructor(@InjectRepository(Usuario) private readonly repo: Repository<Usuario>) {}

  findByEmailConRoles(email: string): Promise<Usuario | null> {
    return this.repo.findOne({ where: { email }, relations: RELACIONES_CON_PERMISOS });
  }

  findByIdConRoles(id: number): Promise<Usuario | null> {
    return this.repo.findOne({ where: { id }, relations: RELACIONES_CON_PERMISOS });
  }

  findById(id: number): Promise<Usuario | null> {
    return this.repo.findOne({ where: { id } });
  }

  save(usuario: Usuario): Promise<Usuario> {
    return this.repo.save(usuario);
  }
}
