import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Departamento } from './entities/departamento.entity.js';
import { Ciudad } from './entities/ciudad.entity.js';
import { Sucursal } from './entities/sucursal.entity.js';
import { EmpleadoSucursal } from './entities/empleado-sucursal.entity.js';
import { Empleado } from './entities/empleado.entity.js';
import { Cliente } from './entities/cliente.entity.js';
import { Usuario } from '../acceso/entities/usuario.entity.js';
import { ClienteRepository } from './repositories/cliente.repository.js';
import { EmpleadoRepository } from './repositories/empleado.repository.js';
import { ClientesController } from './controllers/clientes.controller.js';
import { EmpleadosController } from './controllers/empleados.controller.js';
import { ClientesService } from './services/clientes.service.js';
import { EmpleadosService } from './services/empleados.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Departamento,
      Ciudad,
      Sucursal,
      EmpleadoSucursal,
      Empleado,
      Cliente,
      Usuario,
    ]),
  ],
  controllers: [ClientesController, EmpleadosController],
  providers: [ClientesService, EmpleadosService, ClienteRepository, EmpleadoRepository],
  exports: [TypeOrmModule, ClienteRepository],
})
export class OperacionesModule {}
