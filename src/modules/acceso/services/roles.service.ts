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
    private readonly rolUsuarioRepo: RolUsuarioRepository,
    private readonly rolPermisoRepo: RolPermisoRepository,
    private readonly permisoRepo: PermisoRepository,
  ) {}

  async listar(query: RolesQueryDto): Promise<RolResponseDto[]> {
    const roles = await this.rolRepo.findWithFilters(query);
    const conteos = await this.rolUsuarioRepo.contarActivosPorRoles(roles.map((rol) => rol.id));
    return roles.map((rol) => toRolResponse(rol, conteos.get(rol.id) ?? 0));
  }

  async obtener(id: number): Promise<RolResponseDto> {
    const rol = await this.rolRepo.findByIdConPermisos(id);
    if (!rol) throw new NotFoundException('Rol no encontrado');
    const conteos = await this.rolUsuarioRepo.contarActivosPorRoles([id]);
    return toRolResponse(rol, conteos.get(id) ?? 0);
  }

  async crear(dto: CrearRolDto): Promise<RolResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const nombre = dto.nombre.trim();
      await this.validarNombreDisponible(nombre, undefined, manager);
      const rol = this.rolRepo.create(
        { nombre, descripcion: dto.descripcion?.trim() || null, activo: true },
        manager,
      );
      const guardado = await this.rolRepo.save(rol, manager);
      return toRolResponse(guardado, 0);
    });
  }

  async actualizar(id: number, dto: ActualizarRolDto): Promise<RolResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const rol = await this.rolRepo.findByIdConPermisos(id, manager);
      if (!rol) throw new NotFoundException('Rol no encontrado');

      if (dto.nombre !== undefined) {
        const nombre = dto.nombre.trim();
        await this.validarNombreDisponible(nombre, id, manager);
        rol.nombre = nombre;
      }
      if (dto.descripcion !== undefined) rol.descripcion = dto.descripcion?.trim() || null;
      if (dto.activo !== undefined) rol.activo = dto.activo;

      const guardado = await this.rolRepo.save(rol, manager);
      const conteos = await this.rolUsuarioRepo.contarActivosPorRoles([id], manager);
      return toRolResponse(guardado, conteos.get(id) ?? 0);
    });
  }

  async desactivar(id: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const rol = await this.rolRepo.findByIdConPermisos(id, manager);
      if (!rol) throw new NotFoundException('Rol no encontrado');
      if (!rol.activo) return;
      rol.activo = false;
      await this.rolRepo.save(rol, manager);
    });
  }

  async listarPermisosDeRol(id: number): Promise<PermisoResponseDto[]> {
    const rol = await this.rolRepo.findByIdConPermisos(id);
    if (!rol) throw new NotFoundException('Rol no encontrado');
    return (rol.rolesPermiso ?? [])
      .filter((rolPermiso) => rolPermiso.activo && rolPermiso.permiso?.activo)
      .map((rolPermiso) => toPermisoResponse(rolPermiso.permiso));
  }

  async gestionarPermisos(id: number, dto: GestionarPermisosRolDto): Promise<RolResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const rol = await this.rolRepo.findByIdConPermisos(id, manager);
      if (!rol) throw new NotFoundException('Rol no encontrado');

      const permisos = await this.permisoRepo.findActiveByIds(dto.permisos, manager);
      if (permisos.length !== dto.permisos.length) {
        throw new UnprocessableEntityException('Uno o más permisos no existen o están inactivos');
      }

      await this.rolPermisoRepo.reemplazarPermisos(id, dto.permisos, manager);

      const actualizado = await this.rolRepo.findByIdConPermisos(id, manager);
      const conteos = await this.rolUsuarioRepo.contarActivosPorRoles([id], manager);
      return toRolResponse(actualizado!, conteos.get(id) ?? 0);
    });
  }

  async listarPermisosAgrupados(): Promise<PermisoGrupoResponseDto[]> {
    const permisos = await this.permisoRepo.findAllActivos();
    return agruparPermisos(permisos);
  }

  private async validarNombreDisponible(
    nombre: string,
    idExcluir: number | undefined,
    manager: EntityManager,
  ): Promise<void> {
    const existente = await this.rolRepo.findByNombre(nombre, manager);
    if (existente && existente.id !== idExcluir) {
      throw new ConflictException('Ya existe un rol con ese nombre');
    }
  }
}
