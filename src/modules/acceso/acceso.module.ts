import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { AppConfig } from '../../config/configuration.js';
import { Usuario } from './entities/usuario.entity.js';
import { Empleado } from './entities/empleado.entity.js';
import { Cliente } from './entities/cliente.entity.js';
import { Rol } from './entities/rol.entity.js';
import { Permiso } from './entities/permiso.entity.js';
import { RolPermiso } from './entities/rol-permiso.entity.js';
import { RolUsuario } from './entities/rol-usuario.entity.js';
import { Sesion } from './entities/sesion.entity.js';
import { OperacionesModule } from '../operaciones/operaciones.module.js';
import { AuthController } from './controllers/auth.controller.js';
import { AuthService } from './services/auth.service.js';
import { UsuarioRepository } from './repositories/usuario.repository.js';
import { SesionRepository } from './repositories/sesion.repository.js';
import { ClienteRepository } from './repositories/cliente.repository.js';
import { EmpleadoSucursalRepository } from './repositories/empleado-sucursal.repository.js';
import { JwtStrategy } from './jwt.strategy.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario, Empleado, Cliente, Rol, Permiso, RolPermiso, RolUsuario, Sesion]),
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
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    UsuarioRepository,
    SesionRepository,
    ClienteRepository,
    EmpleadoSucursalRepository,
  ],
  exports: [TypeOrmModule],
})
export class AccesoModule {}
