import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { AppConfig } from '../../config/configuration.js';
import { Usuario } from './entities/usuario.entity.js';
import { Rol } from './entities/rol.entity.js';
import { Permiso } from './entities/permiso.entity.js';
import { RolPermiso } from './entities/rol-permiso.entity.js';
import { RolUsuario } from './entities/rol-usuario.entity.js';
import { Sesion } from './entities/sesion.entity.js';
import { OperacionesModule } from '../operaciones/operaciones.module.js';
import { AuthController } from './controllers/auth.controller.js';
import { UsuariosController } from './controllers/usuarios.controller.js';
import { RolesController } from './controllers/roles.controller.js';
import { PermisosController } from './controllers/permisos.controller.js';
import { PerfilController } from './controllers/perfil.controller.js';
import { BitacoraController } from './controllers/bitacora.controller.js';
import { Bitacora } from './entities/bitacora.entity.js';
import { AuthService } from './services/auth.service.js';
import { UsuariosService } from './services/usuarios.service.js';
import { RolesService } from './services/roles.service.js';
import { PermisosService } from './services/permisos.service.js';
import { PerfilService } from './services/perfil.service.js';
import { BitacoraService } from './services/bitacora.service.js';
import { BitacoraRepository } from './repositories/bitacora.repository.js';
import { UsuarioRepository } from './repositories/usuario.repository.js';
import { SesionRepository } from './repositories/sesion.repository.js';
import { EmpleadoSucursalRepository } from './repositories/empleado-sucursal.repository.js';
import { RolRepository } from './repositories/rol.repository.js';
import { RolUsuarioRepository } from './repositories/rol-usuario.repository.js';
import { RolPermisoRepository } from './repositories/rol-permiso.repository.js';
import { PermisoRepository } from './repositories/permiso.repository.js';
import { JwtStrategy } from './services/jwt.strategy.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario, Rol, Permiso, RolPermiso, RolUsuario, Sesion, Bitacora]),
    OperacionesModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        secret: config.get('jwt.secret', { infer: true }),
        signOptions: {
          expiresIn: config.get('jwt.accessExpiration', { infer: true }),
        } as any,
      }),
    }),
  ],
  controllers: [AuthController, UsuariosController, RolesController, PermisosController, PerfilController, BitacoraController],
  providers: [
    AuthService,
    UsuariosService,
    RolesService,
    PermisosService,
    PerfilService,
    BitacoraService,
    BitacoraRepository,
    JwtStrategy,
    UsuarioRepository,
    SesionRepository,
    EmpleadoSucursalRepository,
    RolRepository,
    RolUsuarioRepository,
    RolPermisoRepository,
    PermisoRepository,
  ],
  exports: [TypeOrmModule],
})
export class AccesoModule {}
