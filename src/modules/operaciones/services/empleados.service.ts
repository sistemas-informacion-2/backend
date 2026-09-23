import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, type EntityManager, type Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { EmpleadoRepository } from '../repositories/empleado.repository.js';
import { AsignacionSucursalRepository } from '../repositories/asignacion-sucursal.repository.js';
import { Usuario } from '../../acceso/entities/usuario.entity.js';
import { Sucursal } from '../entities/sucursal.entity.js';
import { toEmpleadoResponse } from '../mappers/empleado.mapper.js';
import type { CrearEmpleadoDto } from '../dto/crear-empleado.dto.js';
import type { ActualizarEmpleadoDto } from '../dto/actualizar-empleado.dto.js';
import type { EmpleadosQueryDto } from '../dto/empleados-query.dto.js';
import type { GestionarSucursalesEmpleadoDto } from '../dto/gestionar-sucursales-empleado.dto.js';
import type { EmpleadoResponseDto, EmpleadosPaginatedResponseDto } from '../dto/empleado-response.dto.js';

@Injectable()
export class EmpleadosService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly empleadoRepo: EmpleadoRepository,
    private readonly asignacionSucursalRepo: AsignacionSucursalRepository,
    @InjectRepository(Sucursal) private readonly sucursalRepo: Repository<Sucursal>,
  ) {}

  async listar(query: EmpleadosQueryDto): Promise<EmpleadosPaginatedResponseDto> {
    const resultado = await this.empleadoRepo.findPage(query);
    return {
      items: resultado.items.map(toEmpleadoResponse),
      meta: {
        page: query.page,
        limit: query.limit,
        total: resultado.total,
        totalPages: Math.ceil(resultado.total / query.limit),
      },
    };
  }

  async obtenerPorId(id: number): Promise<EmpleadoResponseDto> {
    const empleado = await this.empleadoRepo.findByUsuarioIdConDatos(id);
    if (!empleado) throw new NotFoundException('Empleado no encontrado');
    return toEmpleadoResponse(empleado);
  }

  async crear(dto: CrearEmpleadoDto): Promise<EmpleadoResponseDto> {
    const email = this.normalizarEmail(dto.email);
    if (dto.sucursalIds !== undefined) await this.validarSucursales(dto.sucursalIds);

    return this.dataSource.transaction(async (manager) => {
      await this.validarEmailDisponible(email, undefined, manager);

      const passwordHash = await bcrypt.hash(dto.password, 10);
      const usuario = await manager.getRepository(Usuario).save(
        manager.getRepository(Usuario).create({
          nombre: dto.nombre.trim(),
          apellido: dto.apellido.trim(),
          email,
          telefono: dto.telefono?.trim() || null,
          sexo: dto.sexo?.trim() || null,
          passwordHash,
          tipoUsuario: 'E',
          estadoAcceso: 'HABILITADO',
          intentosFallidos: 0,
          activo: true,
        }),
      );

      const empleado = this.empleadoRepo.create(
        {
          idUsuario: usuario.id,
          codigoEmpleado: this.generarCodigo(usuario.id),
          salario: dto.salario.toFixed(2),
          fechaContratacion: dto.fechaContratacion,
          fechaFinalizacion: null,
        },
        manager,
      );
      await this.empleadoRepo.save(empleado, manager);

      if (dto.sucursalIds !== undefined) {
        await this.asignacionSucursalRepo.reemplazarAsignaciones(usuario.id, dto.sucursalIds, manager);
      }

      return this.obtenerRespuestaEnTransaccion(usuario.id, manager);
    });
  }

  async gestionarSucursales(id: number, dto: GestionarSucursalesEmpleadoDto): Promise<EmpleadoResponseDto> {
    const empleado = await this.empleadoRepo.findByUsuarioIdConDatos(id);
    if (!empleado) throw new NotFoundException('Empleado no encontrado');
    await this.validarSucursales(dto.sucursalIds);
    await this.asignacionSucursalRepo.reemplazarAsignaciones(id, dto.sucursalIds);
    return this.obtenerPorId(id);
  }

  async actualizar(id: number, dto: ActualizarEmpleadoDto): Promise<EmpleadoResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const empleado = await this.empleadoRepo.findByUsuarioIdConDatos(id, manager);
      if (!empleado || !empleado.usuario) throw new NotFoundException('Empleado no encontrado');

      const usuario = empleado.usuario;
      if (dto.email !== undefined) {
        const email = this.normalizarEmail(dto.email);
        await this.validarEmailDisponible(email, id, manager);
        usuario.email = email;
      }
      if (dto.nombre !== undefined) usuario.nombre = dto.nombre.trim();
      if (dto.apellido !== undefined) usuario.apellido = dto.apellido.trim();
      if (dto.telefono !== undefined) usuario.telefono = dto.telefono?.trim() || null;
      if (dto.sexo !== undefined) usuario.sexo = dto.sexo?.trim() || null;
      if (dto.activo !== undefined) usuario.activo = dto.activo;
      if (dto.password !== undefined) usuario.passwordHash = await bcrypt.hash(dto.password, 10);

      if (dto.salario !== undefined) empleado.salario = dto.salario.toFixed(2);
      if (dto.fechaContratacion !== undefined) empleado.fechaContratacion = dto.fechaContratacion;
      if (dto.fechaFinalizacion !== undefined) empleado.fechaFinalizacion = dto.fechaFinalizacion || null;

      await manager.getRepository(Usuario).save(usuario);
      await this.empleadoRepo.save(empleado, manager);

      if (dto.sucursalIds !== undefined) {
        await this.validarSucursales(dto.sucursalIds, manager);
        await this.asignacionSucursalRepo.reemplazarAsignaciones(id, dto.sucursalIds, manager);
      }

      return this.obtenerRespuestaEnTransaccion(id, manager);
    });
  }

  private async validarEmailDisponible(
    email: string,
    idExcluir: number | undefined,
    manager: EntityManager,
  ): Promise<void> {
    const existente = await manager.getRepository(Usuario).findOne({ where: { email } });
    if (existente && existente.id !== idExcluir) {
      throw new ConflictException('El email ya está registrado');
    }
  }

  private async validarSucursales(idsSucursal: number[], manager?: EntityManager): Promise<void> {
    if (idsSucursal.length === 0) return;
    const sucursales = await (manager ?? this.sucursalRepo.manager).getRepository(Sucursal).find({ where: { id: In(idsSucursal) } });
    if (sucursales.length !== new Set(idsSucursal).size) {
      throw new BadRequestException('Una o más sucursales indicadas no existen');
    }
  }

  private generarCodigo(idUsuario: number): string {
    return `EMP-${String(idUsuario).padStart(4, '0')}`;
  }

  private async obtenerRespuestaEnTransaccion(
    id: number,
    manager: EntityManager,
  ): Promise<EmpleadoResponseDto> {
    const empleado = await this.empleadoRepo.findByUsuarioIdConDatos(id, manager);
    if (!empleado) throw new NotFoundException('Empleado no encontrado');
    return toEmpleadoResponse(empleado);
  }

  private normalizarEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
