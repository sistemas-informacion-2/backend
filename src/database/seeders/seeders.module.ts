import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permiso } from '../../modules/acceso/entities/permiso.entity.js';
import { Rol } from '../../modules/acceso/entities/rol.entity.js';
import { RolPermiso } from '../../modules/acceso/entities/rol-permiso.entity.js';
import { RolUsuario } from '../../modules/acceso/entities/rol-usuario.entity.js';
import { Usuario } from '../../modules/acceso/entities/usuario.entity.js';
import { InitialSeederService } from './initial-seeder.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Permiso, Rol, RolPermiso, RolUsuario, Usuario])],
  providers: [InitialSeederService],
  exports: [InitialSeederService],
})
export class SeedersModule {}
