import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { RolRepository } from '../repositories/rol.repository.js';
import { PermisoRepository } from '../repositories/permiso.repository.js';
import { RolPermisoRepository } from '../repositories/rol-permiso.repository.js';
import { toPermisoResponse, toRolResponse } from '../mappers/rol.mapper.js';
import type { CrearRolDto } from '../dto/crear-rol.dto.js';
import type { ActualizarRolDto } from '../dto/actualizar-rol.dto.js';
import type { GestionarPermisosDto } from '../dto/gestionar-permisos.dto.js';
import type { RolesQueryDto } from '../dto/roles-query.dto.js';
import type { RolResponseDto } from '../dto/rol-response.dto.js';

@Injectable()
export class RolesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly rolRepo: RolRepository,
    private readonly permisoRepo: PermisoRepository,
    private readonly rolPermisoRepo: RolPermisoRepository,
  ) {}

  async listarActivos(): Promise<Array<{ id: number; nombre: string }>> {
    const roles = await this.rolRepo.findActive();
    return roles.map((rol) => ({ id: rol.id, nombre: rol.nombre }));
  }

  async listar(query: RolesQueryDto): Promise<RolResponseDto[]> {
    const roles = await this.rolRepo.findAll({
      search: query.search,
      activo: query.activo ?? true,
    });
    return roles.map(toRolResponse);
  }

  async obtenerPorId(id: number): Promise<RolResponseDto> {
    const rol = await this.rolRepo.findByIdWithDetails(id);
    if (!rol) throw new NotFoundException('Rol no encontrado');
    return toRolResponse(rol);
  }

  async crear(dto: CrearRolDto): Promise<RolResponseDto> {
    const nombre = this.normalizarNombre(dto.nombre);
    await this.validarNombreDisponible(nombre);

    const rol = this.rolRepo.create({
      nombre,
      descripcion: dto.descripcion?.trim() || null,
      activo: true,
    });
    const guardado = await this.rolRepo.save(rol);
    return this.obtenerPorId(guardado.id);
  }

  async actualizar(id: number, dto: ActualizarRolDto): Promise<RolResponseDto> {
    const rol = await this.rolRepo.findByIdWithDetails(id);
    if (!rol) throw new NotFoundException('Rol no encontrado');

    if (dto.nombre !== undefined) {
      const nombre = this.normalizarNombre(dto.nombre);
      await this.validarNombreDisponible(nombre, id);
      rol.nombre = nombre;
    }
    if (dto.descripcion !== undefined) rol.descripcion = dto.descripcion?.trim() || null;
    if (dto.activo !== undefined) rol.activo = dto.activo;

    await this.rolRepo.save(rol);
    return this.obtenerPorId(id);
  }

  async eliminar(id: number): Promise<void> {
    const rol = await this.rolRepo.findByIdWithDetails(id);
    if (!rol) throw new NotFoundException('Rol no encontrado');
    if (!rol.activo) return;

    rol.activo = false;
    await this.rolRepo.save(rol);
  }

  async listarPermisosDelRol(idRol: number) {
    const rol = await this.rolRepo.findByIdWithDetails(idRol);
    if (!rol) throw new NotFoundException('Rol no encontrado');
    return rol.rolesPermiso
      .filter((relacion) => relacion.activo && relacion.permiso?.activo)
      .map((relacion) => toPermisoResponse(relacion.permiso));
  }

  async gestionarPermisos(idRol: number, dto: GestionarPermisosDto): Promise<RolResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const rol = await this.rolRepo.findByIdWithDetails(idRol, manager);
      if (!rol) throw new NotFoundException('Rol no encontrado');
      if (!rol.activo) throw new UnprocessableEntityException('No se pueden asignar permisos a un rol inactivo');

      const permisos = await this.permisoRepo.findActiveByIds(dto.permisos, manager);
      if (permisos.length !== dto.permisos.length) {
        throw new UnprocessableEntityException('Uno o más permisos no existen o están inactivos');
      }

      await this.rolPermisoRepo.reemplazarPermisos(idRol, dto.permisos, manager);
      return this.obtenerRespuestaEnTransaccion(idRol, manager);
    });
  }

  private async validarNombreDisponible(nombre: string, idExcluir?: number): Promise<void> {
    const existente = await this.rolRepo.findByName(nombre);
    if (existente && existente.id !== idExcluir) throw new ConflictException('El nombre del rol ya está registrado');
  }

  private async obtenerRespuestaEnTransaccion(id: number, manager: EntityManager): Promise<RolResponseDto> {
    const rol = await this.rolRepo.findByIdWithDetails(id, manager);
    if (!rol) throw new NotFoundException('Rol no encontrado');
    return toRolResponse(rol);
  }

  private normalizarNombre(nombre: string): string {
    return nombre.trim().toUpperCase();
  }
}
