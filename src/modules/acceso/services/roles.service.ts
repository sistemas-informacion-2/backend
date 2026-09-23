import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { RolRepository } from '../repositories/rol.repository.js';
import { RolUsuarioRepository } from '../repositories/rol-usuario.repository.js';
import { RolPermisoRepository } from '../repositories/rol-permiso.repository.js';
import { PermisoRepository } from '../repositories/permiso.repository.js';
import { agruparPermisos, toPermisoResponse, toRolResponse } from '../mappers/rol.mapper.js';
import type { CrearRolDto } from '../dto/crear-rol.dto.js';
import type { ActualizarRolDto } from '../dto/actualizar-rol.dto.js';
import type { GestionarPermisosRolDto } from '../dto/gestionar-permisos-rol.dto.js';
import type { RolesQueryDto } from '../dto/roles-query.dto.js';
import type { PermisoGrupoResponseDto, PermisoResponseDto, RolResponseDto } from '../dto/rol-response.dto.js';

@Injectable()
export class RolesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly rolRepo: RolRepository,
    private readonly permisoRepo: PermisoRepository,
    private readonly rolPermisoRepo: RolPermisoRepository,
    private readonly rolUsuarioRepo?: RolUsuarioRepository,
  ) {}

  async listar(query: RolesQueryDto): Promise<RolResponseDto[]> {
    const roles = await this.rolRepo.findAll({
      search: query.search,
      activo: query.activo ?? true,
    });
    return roles.map((rol) => toRolResponse(rol));
  }

  async obtener(id: number): Promise<RolResponseDto> {
    const rol = await this.rolRepo.findByIdWithDetails(id);
    if (!rol) throw new NotFoundException('Rol no encontrado');
    const cantidad = this.rolUsuarioRepo
      ? (await this.rolUsuarioRepo.contarActivosPorRoles([id])).get(id) ?? 0
      : undefined;
    return toRolResponse(rol, cantidad);
  }

  async obtenerPorId(id: number): Promise<RolResponseDto> {
    return this.obtener(id);
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
    return this.obtener(guardado.id);
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
    return this.obtener(id);
  }

  async desactivar(id: number): Promise<void> {
    const rol = await this.rolRepo.findByIdWithDetails(id);
    if (!rol) throw new NotFoundException('Rol no encontrado');
    if (rol.activo) {
      rol.activo = false;
      await this.rolRepo.save(rol);
    }
  }

  async eliminar(id: number): Promise<void> {
    return this.desactivar(id);
  }

  async listarPermisosDeRol(id: number): Promise<PermisoResponseDto[]> {
    const rol = await this.rolRepo.findByIdWithDetails(id);
    if (!rol) throw new NotFoundException('Rol no encontrado');
    return (rol.rolesPermiso ?? [])
      .filter((relacion) => relacion.activo && relacion.permiso?.activo)
      .map((relacion) => toPermisoResponse(relacion.permiso));
  }

  async listarPermisosDelRol(id: number): Promise<PermisoResponseDto[]> {
    return this.listarPermisosDeRol(id);
  }

  async gestionarPermisos(id: number, dto: GestionarPermisosRolDto): Promise<RolResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const rol = await this.rolRepo.findByIdWithDetails(id, manager);
      if (!rol) throw new NotFoundException('Rol no encontrado');
      if (!rol.activo) throw new UnprocessableEntityException('No se pueden asignar permisos a un rol inactivo');

      const permisos = await this.permisoRepo.findActiveByIds(dto.permisos, manager);
      if (permisos.length !== dto.permisos.length) {
        throw new UnprocessableEntityException('Uno o más permisos no existen o están inactivos');
      }

      await this.rolPermisoRepo.reemplazarPermisos(id, dto.permisos, manager);
      const actualizado = await this.rolRepo.findByIdWithDetails(id, manager);
      if (!actualizado) throw new NotFoundException('Rol no encontrado');
      return toRolResponse(actualizado);
    });
  }

  async listarPermisosAgrupados(): Promise<PermisoGrupoResponseDto[]> {
    const permisos = await this.permisoRepo.findAllActivos();
    return agruparPermisos(permisos);
  }

  private async validarNombreDisponible(nombre: string, idExcluir?: number): Promise<void> {
    const existente = await this.rolRepo.findByName(nombre);
    if (existente && existente.id !== idExcluir) {
      throw new ConflictException('El nombre del rol ya está registrado');
    }
  }

  private normalizarNombre(nombre: string): string {
    return nombre.trim().toUpperCase();
  }
}
