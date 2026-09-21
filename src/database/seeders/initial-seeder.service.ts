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
  'inventario:almacen:gestionar',
  'comercial:pasarelas:gestionar',
  'comercial:pasarelas:leer',
  'comercial:caja:gestionar',
  'electronico:notificaciones:gestionar',
];

/**
 * Roles operativos descritos en Explicacion/Actores.md (todos menos
 * Administrador, que ya tiene su propio flujo, y Cliente, que no es un rol
 * interno). Los permisos asignados son los mas cercanos ya implementados;
 * varios CUs que describen mejor a estos actores (Ventas, Caja,
 * Inventario/Almacen) todavia no existen, asi que estos sets deben
 * revisarse cuando esos modulos se construyan.
 */
const ROLES_BASE: Array<{ nombre: string; descripcion: string; permisos: string[] }> = [
  {
    nombre: 'ENCARGADO_SUCURSAL',
    descripcion:
      'Responsable de las operaciones de una sucursal: disponibilidad de prendas, atencion a clientes y supervision del inventario local.',
    permisos: ['operaciones:sucursales:gestionar', 'acceso:clientes:gestionar', 'comercial:pasarelas:leer', 'comercial:caja:gestionar'],
  },
  {
    nombre: 'VENDEDOR_CAJERO',
    descripcion: 'Atiende ventas presenciales y gestiona los datos de clientes en el punto de venta.',
    permisos: ['acceso:clientes:gestionar', 'comercial:pasarelas:leer', 'comercial:caja:gestionar'],
  },
  {
    nombre: 'ENCARGADO_INVENTARIO',
    descripcion: 'Controla existencias, registra el ingreso de productos y actualiza disponibilidad por sucursal.',
    permisos: ['inventario:productos:gestionar', 'inventario:categorias:gestionar', 'inventario:almacen:gestionar'],
  },
  {
    nombre: 'ENCARGADO_COMPRAS',
    descripcion: 'Gestiona proveedores, registra compras y coordina el ingreso de productos al inventario.',
    permisos: ['inventario:proveedores:gestionar', 'inventario:productos:gestionar'],
  },
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

    const permisosPorAccion = new Map(permisos.map((permiso) => [permiso.accion, permiso]));
    for (const rolBase of ROLES_BASE) {
      let rol = await this.rolRepo.findOne({ where: { nombre: rolBase.nombre } });
      if (!rol) {
        rol = await this.rolRepo.save(this.rolRepo.create({ nombre: rolBase.nombre, descripcion: rolBase.descripcion }));
        this.logger.log(`Rol creado: ${rolBase.nombre}`);
      }

      for (const accion of rolBase.permisos) {
        const permiso = permisosPorAccion.get(accion);
        if (!permiso) continue;
        const existe = await this.rolPermisoRepo.findOne({ where: { idRol: rol.id, idPermiso: permiso.id } });
        if (!existe) {
          await this.rolPermisoRepo.save(this.rolPermisoRepo.create({ idRol: rol.id, idPermiso: permiso.id }));
        }
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
