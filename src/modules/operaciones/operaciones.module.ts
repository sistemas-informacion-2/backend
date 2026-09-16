import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Departamento } from './entities/departamento.entity.js';
import { Ciudad } from './entities/ciudad.entity.js';
import { Sucursal } from './entities/sucursal.entity.js';
import { EmpleadoSucursal } from './entities/empleado-sucursal.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Departamento, Ciudad, Sucursal, EmpleadoSucursal])],
  exports: [TypeOrmModule],
})
export class OperacionesModule {}
