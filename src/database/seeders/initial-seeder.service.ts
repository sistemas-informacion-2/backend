import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import type { Repository } from 'typeorm';
import type { AppConfig } from '../../config/configuration.js';
import { Permiso } from '../../modules/acceso/entities/permiso.entity.js';
import { Rol } from '../../modules/acceso/entities/rol.entity.js';
import { RolPermiso } from '../../modules/acceso/entities/rol-permiso.entity.js';
import { RolUsuario } from '../../modules/acceso/entities/rol-usuario.entity.js';
import { Usuario } from '../../modules/acceso/entities/usuario.entity.js';

const PERMISOS_BASE = [
  'acceso:usuarios:gestionar',
  'acceso:roles:gestionar',
  'acceso:clientes:gestionar',
  'acceso:bitacora:leer',
  'operaciones:empleados:gestionar',
  'operaciones:sucursales:gestionar',
  'inventario:categorias:gestionar',
  'inventario:productos:gestionar',
  'inventario:proveedores:gestionar',
  'inventario:temporadas:gestionar',
];

/**
 * Siembra los datos mínimos para poder usar el sistema: permisos base, rol
 * ADMINISTRADOR y el usuario admin (credenciales en SEED_ADMIN_EMAIL /
 * SEED_ADMIN_PASSWORD). Es idempotente: se llama tanto en cada arranque de
 * la app (main.ts) como desde el script standalone `npm run seed`.
 */
@Injectable()
export class InitialSeederService {
  private readonly logger = new Logger(InitialSeederService.name);

  constructor(
    @InjectRepository(Permiso) private readonly permisoRepo: Repository<Permiso>,
    @InjectRepository(Rol) private readonly rolRepo: Repository<Rol>,
    @InjectRepository(RolPermiso) private readonly rolPermisoRepo: Repository<RolPermiso>,
    @InjectRepository(RolUsuario) private readonly rolUsuarioRepo: Repository<RolUsuario>,
    @InjectRepository(Usuario) private readonly usuarioRepo: Repository<Usuario>,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async run(): Promise<void> {
    const permisos: Permiso[] = [];
    for (const accion of PERMISOS_BASE) {
      let permiso = await this.permisoRepo.findOne({ where: { accion } });
      if (!permiso) {
        permiso = await this.permisoRepo.save(this.permisoRepo.create({ accion }));
        this.logger.log(`Permiso creado: ${accion}`);
      }
      permisos.push(permiso);
    }

    let rolAdmin = await this.rolRepo.findOne({ where: { nombre: 'ADMINISTRADOR' } });
    if (!rolAdmin) {
      rolAdmin = await this.rolRepo.save(
        this.rolRepo.create({ nombre: 'ADMINISTRADOR', descripcion: 'Acceso total al sistema' }),
      );
      this.logger.log('Rol ADMINISTRADOR creado');
    }

    for (const permiso of permisos) {
      const existe = await this.rolPermisoRepo.findOne({
        where: { idRol: rolAdmin.id, idPermiso: permiso.id },
      });
      if (!existe) {
        await this.rolPermisoRepo.save(this.rolPermisoRepo.create({ idRol: rolAdmin.id, idPermiso: permiso.id }));
      }
    }

    const email = this.config.get('seed.adminEmail', { infer: true });
    const password = this.config.get('seed.adminPassword', { infer: true });

    let admin = await this.usuarioRepo.findOne({ where: { email } });
    if (!admin) {
      const passwordHash = await bcrypt.hash(password, 10);
      admin = await this.usuarioRepo.save(
        this.usuarioRepo.create({
          nombre: 'Administrador',
          apellido: 'FashionStore',
          email,
          passwordHash,
          tipoUsuario: 'A',
          estadoAcceso: 'HABILITADO',
        }),
      );
      this.logger.log(`Usuario administrador creado: ${email}`);
    }

    const yaTieneRol = await this.rolUsuarioRepo.findOne({
      where: { idRol: rolAdmin.id, idUsuario: admin.id },
    });
    if (!yaTieneRol) {
      await this.rolUsuarioRepo.save(this.rolUsuarioRepo.create({ idRol: rolAdmin.id, idUsuario: admin.id }));
    }
  }
}
