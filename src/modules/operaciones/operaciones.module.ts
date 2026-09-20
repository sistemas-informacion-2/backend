import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Departamento } from './entities/departamento.entity.js';
import { Ciudad } from './entities/ciudad.entity.js';
import { Sucursal } from './entities/sucursal.entity.js';
import { EmpleadoSucursal } from './entities/empleado-sucursal.entity.js';
import { Empleado } from './entities/empleado.entity.js';
import { Cliente } from './entities/cliente.entity.js';
import { Usuario } from '../acceso/entities/usuario.entity.js';
import { SucursalesController } from './controllers/sucursales.controller.js';
import { UbicacionController } from './controllers/ubicacion.controller.js';
import { ClientesController } from './controllers/clientes.controller.js';
import { EmpleadosController } from './controllers/empleados.controller.js';
import { SucursalesService } from './services/sucursales.service.js';
import { UbicacionService } from './services/ubicacion.service.js';
import { ClientesService } from './services/clientes.service.js';
import { EmpleadosService } from './services/empleados.service.js';
import { SucursalRepository } from './repositories/sucursal.repository.js';
import { CiudadRepository } from './repositories/ciudad.repository.js';
import { DepartamentoRepository } from './repositories/departamento.repository.js';
import { UbicacionSeederService } from './seeders/ubicacion-seeder.service.js';
import { ClienteRepository } from './repositories/cliente.repository.js';
import { EmpleadoRepository } from './repositories/empleado.repository.js';
import { AsignacionSucursalRepository } from './repositories/asignacion-sucursal.repository.js';

@Module({
  imports: [TypeOrmModule.forFeature([Departamento, Ciudad, Sucursal, EmpleadoSucursal, Empleado, Cliente, Usuario])],
  controllers: [SucursalesController, UbicacionController, ClientesController, EmpleadosController],
  providers: [
    SucursalesService,
    UbicacionService,
    SucursalRepository,
    CiudadRepository,
    DepartamentoRepository,
    UbicacionSeederService,
    ClientesService,
    EmpleadosService,
    ClienteRepository,
    EmpleadoRepository,
    AsignacionSucursalRepository,
  ],
  exports: [TypeOrmModule, UbicacionSeederService, ClienteRepository],
})
export class OperacionesModule {}
