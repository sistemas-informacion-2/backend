import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UsuarioRepository } from '../repositories/usuario.repository.js';
import { RolRepository } from '../repositories/rol.repository.js';
import { RolUsuarioRepository } from '../repositories/rol-usuario.repository.js';
import { SesionRepository } from '../repositories/sesion.repository.js';
import { toUsuarioResponse } from '../mappers/usuario.mapper.js';
import type { CrearUsuarioDto } from '../dto/crear-usuario.dto.js';
import type { ActualizarUsuarioDto } from '../dto/actualizar-usuario.dto.js';
import type { GestionarRolesDto } from '../dto/gestionar-roles.dto.js';
import type { UsuariosQueryDto } from '../dto/usuarios-query.dto.js';
import type { UsuarioResponseDto, UsuariosPaginatedResponseDto } from '../dto/usuario-response.dto.js';

@Injectable()
export class UsuariosService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly usuarioRepo: UsuarioRepository,
    private readonly rolRepo: RolRepository,
    private readonly rolUsuarioRepo: RolUsuarioRepository,
    private readonly sesionRepo: SesionRepository,
  ) {}

  async listar(query: UsuariosQueryDto): Promise<UsuariosPaginatedResponseDto> {
    const resultado = await this.usuarioRepo.findPage(query);
    return {
      items: resultado.items.map(toUsuarioResponse),
      meta: {
        page: query.page,
        limit: query.limit,
        total: resultado.total,
        totalPages: Math.ceil(resultado.total / query.limit),
      },
    };
  }

  async obtenerPorId(id: number): Promise<UsuarioResponseDto> {
    const usuario = await this.usuarioRepo.findByIdConRolesParaGestion(id);
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    return toUsuarioResponse(usuario);
  }

  async crear(dto: CrearUsuarioDto): Promise<UsuarioResponseDto> {
    const email = this.normalizarEmail(dto.email);

    return this.dataSource.transaction(async (manager) => {
      await this.validarEmailDisponible(email, undefined, manager);
      const roles = await this.validarRoles(dto.roles ?? [], manager);
      const passwordHash = await bcrypt.hash(dto.password, 10);
      const usuario = this.usuarioRepo.create(
        {
          nombre: dto.nombre.trim(),
          apellido: dto.apellido.trim(),
          email,
          telefono: dto.telefono?.trim() || null,
          sexo: dto.sexo?.trim() || null,
          passwordHash,
          tipoUsuario: dto.tipoUsuario,
          estadoAcceso: dto.estadoAcceso ?? 'HABILITADO',
          intentosFallidos: 0,
          activo: true,
        },
        manager,
      );
      const guardado = await this.usuarioRepo.save(usuario, manager);

      if (roles.length > 0) {
        await this.rolUsuarioRepo.reemplazarRoles(guardado.id, roles.map((rol) => rol.id), manager);
      }

      return this.obtenerRespuestaEnTransaccion(guardado.id, manager);
    });
  }

  async actualizar(id: number, dto: ActualizarUsuarioDto): Promise<UsuarioResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const usuario = await this.usuarioRepo.findByIdConRolesParaGestion(id, manager);
      if (!usuario) throw new NotFoundException('Usuario no encontrado');

      if (dto.email !== undefined) {
        const email = this.normalizarEmail(dto.email);
        await this.validarEmailDisponible(email, id, manager);
        usuario.email = email;
      }
      if (dto.nombre !== undefined) usuario.nombre = dto.nombre.trim();
      if (dto.apellido !== undefined) usuario.apellido = dto.apellido.trim();
      if (dto.telefono !== undefined) usuario.telefono = dto.telefono?.trim() || null;
      if (dto.sexo !== undefined) usuario.sexo = dto.sexo?.trim() || null;
      if (dto.tipoUsuario !== undefined) usuario.tipoUsuario = dto.tipoUsuario;
      if (dto.estadoAcceso !== undefined) usuario.estadoAcceso = dto.estadoAcceso;
      if (dto.activo !== undefined) usuario.activo = dto.activo;
      if (dto.password !== undefined) usuario.passwordHash = await bcrypt.hash(dto.password, 10);
      if (dto.estadoAcceso === 'HABILITADO') usuario.intentosFallidos = 0;

      await this.usuarioRepo.save(usuario, manager);

      if (!usuario.activo || usuario.estadoAcceso !== 'HABILITADO' || dto.password !== undefined) {
        await this.sesionRepo.cerrarAbiertasPorUsuario(id, manager);
      }

      return this.obtenerRespuestaEnTransaccion(id, manager);
    });
  }

  async gestionarRoles(id: number, dto: GestionarRolesDto): Promise<UsuarioResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const usuario = await this.usuarioRepo.findByIdConRolesParaGestion(id, manager);
      if (!usuario) throw new NotFoundException('Usuario no encontrado');
      await this.validarRoles(dto.roles, manager);
      await this.rolUsuarioRepo.reemplazarRoles(id, dto.roles, manager);
      return this.obtenerRespuestaEnTransaccion(id, manager);
    });
  }

  async eliminar(id: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const usuario = await this.usuarioRepo.findByIdConRolesParaGestion(id, manager);
      if (!usuario) throw new NotFoundException('Usuario no encontrado');
      if (!usuario.activo) return;

      usuario.activo = false;
      usuario.estadoAcceso = 'SUSPENDIDO';
      await this.usuarioRepo.save(usuario, manager);
      await this.sesionRepo.cerrarAbiertasPorUsuario(id, manager);
    });
  }

  private async validarEmailDisponible(
    email: string,
    idExcluir: number | undefined,
    manager: EntityManager,
  ): Promise<void> {
    const existente = await this.usuarioRepo.findByEmail(email, manager);
    if (existente && existente.id !== idExcluir) {
      throw new ConflictException('El email ya está registrado');
    }
  }

  private async validarRoles(
    idsRol: number[],
    manager: EntityManager,
  ) {
    const roles = await this.rolRepo.findActiveByIds(idsRol, manager);
    if (roles.length !== idsRol.length) {
      throw new UnprocessableEntityException('Uno o más roles no existen o están inactivos');
    }
    return roles;
  }

  private async obtenerRespuestaEnTransaccion(
    id: number,
    manager: EntityManager,
  ): Promise<UsuarioResponseDto> {
    const usuario = await this.usuarioRepo.findByIdConRolesParaGestion(id, manager);
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    return toUsuarioResponse(usuario);
  }

  private normalizarEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
