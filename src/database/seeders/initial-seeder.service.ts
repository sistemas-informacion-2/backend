import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { In, IsNull, type EntityManager, type Repository } from 'typeorm';
import type { AppConfig } from '../../config/configuration.js';
import { Permiso } from '../../modules/acceso/entities/permiso.entity.js';
import { Rol } from '../../modules/acceso/entities/rol.entity.js';
import { RolPermiso } from '../../modules/acceso/entities/rol-permiso.entity.js';
import { RolUsuario } from '../../modules/acceso/entities/rol-usuario.entity.js';
import { Usuario } from '../../modules/acceso/entities/usuario.entity.js';
// Los seeders corren fuera de un request, sin TenantContext: la empresa va explicita.
import { ID_EMPRESA_INICIAL } from '../migraciones.util.js';

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
  'inventario:almacen:leer',
  'comercial:pasarelas:gestionar',
  'comercial:pasarelas:leer',
  'comercial:caja:gestionar',
  'comercial:compras:gestionar',
  'comercial:ventas:gestionar',
  'electronico:reservas:gestionar',
  'electronico:ventas:leer',
  'comercial:devoluciones:gestionar',
  'electronico:notificaciones:gestionar',
  'analitica:dashboard:leer',
  'analitica:reportes:gestionar',
  // BI: usar el asistente y los dashboards; actualizar el Data Warehouse a pedido.
  'analitica:bi:usar',
  'analitica:bi:etl',
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
    permisos: ['operaciones:sucursales:gestionar', 'acceso:clientes:gestionar', 'comercial:pasarelas:leer', 'comercial:caja:gestionar', 'comercial:ventas:gestionar', 'electronico:reservas:gestionar', 'comercial:devoluciones:gestionar', 'inventario:almacen:leer', 'analitica:reportes:gestionar', 'analitica:bi:usar'],
  },
  {
    nombre: 'VENDEDOR_CAJERO',
    descripcion: 'Atiende ventas presenciales y gestiona los datos de clientes en el punto de venta.',
    permisos: ['acceso:clientes:gestionar', 'comercial:pasarelas:leer', 'comercial:caja:gestionar', 'comercial:ventas:gestionar', 'electronico:reservas:gestionar', 'comercial:devoluciones:gestionar', 'inventario:almacen:leer'],
  },
  {
    nombre: 'ENCARGADO_INVENTARIO',
    descripcion: 'Controla existencias, registra el ingreso de productos y actualiza disponibilidad por sucursal.',
    permisos: ['inventario:productos:gestionar', 'inventario:categorias:gestionar', 'inventario:almacen:gestionar'],
  },
  {
    nombre: 'ENCARGADO_COMPRAS',
    descripcion: 'Gestiona proveedores, registra compras y coordina el ingreso de productos al inventario.',
    permisos: [
      'inventario:proveedores:gestionar',
      'inventario:productos:gestionar',
      'inventario:almacen:gestionar',
      'comercial:compras:gestionar',
    ],
  },
];

/**
 * Datos del primer administrador de una empresa. La contrasena viene en claro (seeders, alta del superadmin) o ya
 * cifrada (registro desde el portal: se cifro antes de esperar el pago, para no guardarla en claro).
 */
export type DatosAdministrador = {
  nombre: string;
  apellido: string;
  email: string;
  telefono?: string | null;
} & ({ password: string; passwordHash?: never } | { passwordHash: string; password?: never });

/**
 * Siembra los datos minimos del sistema y es idempotente: se llama en cada
 * arranque de la app (main.ts) y desde el script standalone `npm run seed`.
 *
 * - Permisos base: globales, compartidos por todas las empresas.
 * - Roles base y administrador de la empresa inicial (SEED_ADMIN_EMAIL /
 *   SEED_ADMIN_PASSWORD).
 * - Superadmin de la plataforma (SEED_SUPERADMIN_EMAIL /
 *   SEED_SUPERADMIN_PASSWORD), solo si esas variables estan definidas.
 *
 * `sembrarRolesEn` y `crearAdministradorEn` los reutiliza tambien el alta de
 * empresas (AprovisionamientoService) dentro de su transaccion.
 */
@Injectable()
export class InitialSeederService {
  private readonly logger = new Logger(InitialSeederService.name);

  constructor(
    @InjectRepository(Permiso) private readonly permisoRepo: Repository<Permiso>,
    @InjectRepository(Usuario) private readonly usuarioRepo: Repository<Usuario>,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async run(): Promise<void> {
    for (const accion of PERMISOS_BASE) {
      const existe = await this.permisoRepo.findOne({ where: { accion } });
      if (!existe) {
        await this.permisoRepo.save(this.permisoRepo.create({ accion }));
        this.logger.log(`Permiso creado: ${accion}`);
      }
    }

    const manager = this.usuarioRepo.manager;
    const rolAdmin = await this.sembrarRolesEn(manager, ID_EMPRESA_INICIAL);

    const email = this.config.get('seed.adminEmail', { infer: true });
    const existente = await this.usuarioRepo.findOne({ where: { email, idEmpresa: ID_EMPRESA_INICIAL } });
    if (existente) {
      await this.asegurarRol(manager, rolAdmin.id, existente.id);
    } else {
      const password = this.config.get('seed.adminPassword', { infer: true });
      await this.crearAdministradorEn(manager, ID_EMPRESA_INICIAL, rolAdmin, { nombre: 'Administrador', apellido: 'FashionStore', email, password });
      this.logger.log(`Usuario administrador creado: ${email}`);
    }

    await this.asegurarSuperadmin();
  }

  /** Crea (si faltan) el rol ADMINISTRADOR con todos los permisos y los roles operativos base de una empresa. */
  async sembrarRolesEn(manager: EntityManager, idEmpresa: number): Promise<Rol> {
    const permisos = await manager.getRepository(Permiso).find({ where: { accion: In(PERMISOS_BASE) } });
    const permisosPorAccion = new Map(permisos.map((permiso) => [permiso.accion, permiso]));

    const rolAdmin = await this.asegurarRolBase(manager, idEmpresa, 'ADMINISTRADOR', 'Acceso total al sistema', PERMISOS_BASE, permisosPorAccion);
    for (const rolBase of ROLES_BASE) {
      await this.asegurarRolBase(manager, idEmpresa, rolBase.nombre, rolBase.descripcion, rolBase.permisos, permisosPorAccion);
    }
    return rolAdmin;
  }

  /** Crea el usuario administrador (tipo A) de una empresa y le asigna el rol ADMINISTRADOR. */
  async crearAdministradorEn(manager: EntityManager, idEmpresa: number, rolAdmin: Rol, datos: DatosAdministrador): Promise<Usuario> {
    const usuarioRepo = manager.getRepository(Usuario);
    const admin = await usuarioRepo.save(
      usuarioRepo.create({
        nombre: datos.nombre,
        apellido: datos.apellido,
        email: datos.email.trim().toLowerCase(),
        telefono: datos.telefono ?? null,
        passwordHash: datos.passwordHash !== undefined ? datos.passwordHash : await bcrypt.hash(datos.password, 10),
        idEmpresa,
        tipoUsuario: 'A',
        estadoAcceso: 'HABILITADO',
      }),
    );
    await this.asegurarRol(manager, rolAdmin.id, admin.id);
    return admin;
  }

  private async asegurarRolBase(
    manager: EntityManager,
    idEmpresa: number,
    nombre: string,
    descripcion: string,
    acciones: string[],
    permisosPorAccion: Map<string, Permiso>,
  ): Promise<Rol> {
    const rolRepo = manager.getRepository(Rol);
    let rol = await rolRepo.findOne({ where: { nombre, idEmpresa } });
    if (!rol) {
      rol = await rolRepo.save(rolRepo.create({ nombre, descripcion, idEmpresa }));
      this.logger.log(`Rol creado: ${nombre} (empresa ${idEmpresa})`);
    }

    const rolPermisoRepo = manager.getRepository(RolPermiso);
    for (const accion of acciones) {
      const permiso = permisosPorAccion.get(accion);
      if (!permiso) continue;
      const existe = await rolPermisoRepo.findOne({ where: { idRol: rol.id, idPermiso: permiso.id } });
      if (!existe) await rolPermisoRepo.save(rolPermisoRepo.create({ idRol: rol.id, idPermiso: permiso.id }));
    }
    return rol;
  }

  private async asegurarRol(manager: EntityManager, idRol: number, idUsuario: number): Promise<void> {
    const rolUsuarioRepo = manager.getRepository(RolUsuario);
    const existe = await rolUsuarioRepo.findOne({ where: { idRol, idUsuario } });
    if (!existe) await rolUsuarioRepo.save(rolUsuarioRepo.create({ idRol, idUsuario }));
  }

  /** El superadmin no pertenece a ninguna empresa (id_empresa NULL) y solo opera las rutas /plataforma. */
  private async asegurarSuperadmin(): Promise<void> {
    const email = this.config.get('seed.superadminEmail', { infer: true });
    const password = this.config.get('seed.superadminPassword', { infer: true });
    if (!email || !password) return;

    const existente = await this.usuarioRepo.findOne({ where: { email, idEmpresa: IsNull() } });
    if (existente) return;

    await this.usuarioRepo.save(
      this.usuarioRepo.create({
        nombre: 'Superadmin',
        apellido: 'Plataforma',
        email,
        passwordHash: await bcrypt.hash(password, 10),
        idEmpresa: null,
        tipoUsuario: 'S',
        estadoAcceso: 'HABILITADO',
      }),
    );
    this.logger.log(`Superadmin de la plataforma creado: ${email}`);
  }
}
