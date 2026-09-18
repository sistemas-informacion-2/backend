import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Departamento } from './entities/departamento.entity.js';
import { Ciudad } from './entities/ciudad.entity.js';
import { Sucursal } from './entities/sucursal.entity.js';
import { EmpleadoSucursal } from './entities/empleado-sucursal.entity.js';
import { SucursalesController } from './controllers/sucursales.controller.js';
import { UbicacionController } from './controllers/ubicacion.controller.js';
import { SucursalesService } from './services/sucursales.service.js';
import { UbicacionService } from './services/ubicacion.service.js';
import { SucursalRepository } from './repositories/sucursal.repository.js';
import { CiudadRepository } from './repositories/ciudad.repository.js';
import { DepartamentoRepository } from './repositories/departamento.repository.js';
import { UbicacionSeederService } from './seeders/ubicacion-seeder.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Departamento, Ciudad, Sucursal, EmpleadoSucursal])],
  controllers: [SucursalesController, UbicacionController],
  providers: [
    SucursalesService,
    UbicacionService,
    SucursalRepository,
    CiudadRepository,
    DepartamentoRepository,
    UbicacionSeederService,
  ],
  exports: [TypeOrmModule, UbicacionSeederService],
})
export class OperacionesModule {}
