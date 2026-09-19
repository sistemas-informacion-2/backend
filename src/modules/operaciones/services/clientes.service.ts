import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ClienteRepository } from '../repositories/cliente.repository.js';
import { Usuario } from '../../acceso/entities/usuario.entity.js';
import { toClienteResponse } from '../mappers/cliente.mapper.js';
import type { CrearClienteDto } from '../dto/crear-cliente.dto.js';
import type { ActualizarClienteDto } from '../dto/actualizar-cliente.dto.js';
import type { ClientesQueryDto } from '../dto/clientes-query.dto.js';
import type { ClienteResponseDto, ClientesPaginatedResponseDto } from '../dto/cliente-response.dto.js';

@Injectable()
export class ClientesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly clienteRepo: ClienteRepository,
  ) {}

  async listar(query: ClientesQueryDto): Promise<ClientesPaginatedResponseDto> {
    const resultado = await this.clienteRepo.findPage(query);
    return {
      items: resultado.items.map(toClienteResponse),
      meta: {
        page: query.page,
        limit: query.limit,
        total: resultado.total,
        totalPages: Math.ceil(resultado.total / query.limit),
      },
    };
  }

  async obtenerPorId(id: number): Promise<ClienteResponseDto> {
    const cliente = await this.clienteRepo.findByUsuarioIdConDatos(id);
    if (!cliente) throw new NotFoundException('Cliente no encontrado');
    return toClienteResponse(cliente);
  }

  async crear(dto: CrearClienteDto): Promise<ClienteResponseDto> {
    const email = this.normalizarEmail(dto.email);

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
          tipoUsuario: 'C',
          estadoAcceso: 'HABILITADO',
          intentosFallidos: 0,
          activo: true,
        }),
      );

      const cliente = this.clienteRepo.create(
        {
          idUsuario: usuario.id,
          ciudadResidencia: dto.ciudadResidencia?.trim() || null,
          direccionPrincipal: dto.direccionPrincipal?.trim() || null,
          puntosFidelidad: 0,
        },
        manager,
      );
      await this.clienteRepo.save(cliente, manager);

      return this.obtenerRespuestaEnTransaccion(usuario.id, manager);
    });
  }

  async actualizar(id: number, dto: ActualizarClienteDto): Promise<ClienteResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const cliente = await this.clienteRepo.findByUsuarioIdConDatos(id, manager);
      if (!cliente || !cliente.usuario) throw new NotFoundException('Cliente no encontrado');

      const usuario = cliente.usuario;
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

      if (dto.ciudadResidencia !== undefined) cliente.ciudadResidencia = dto.ciudadResidencia?.trim() || null;
      if (dto.direccionPrincipal !== undefined) {
        cliente.direccionPrincipal = dto.direccionPrincipal?.trim() || null;
      }

      await manager.getRepository(Usuario).save(usuario);
      await this.clienteRepo.save(cliente, manager);

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

  private async obtenerRespuestaEnTransaccion(
    id: number,
    manager: EntityManager,
  ): Promise<ClienteResponseDto> {
    const cliente = await this.clienteRepo.findByUsuarioIdConDatos(id, manager);
    if (!cliente) throw new NotFoundException('Cliente no encontrado');
    return toClienteResponse(cliente);
  }

  private normalizarEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
