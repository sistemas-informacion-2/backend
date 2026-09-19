import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service.js';
import { UsuarioRepository } from '../repositories/usuario.repository.js';
import { ClienteRepository } from '../../operaciones/repositories/cliente.repository.js';
import type { ActualizarPerfilDto } from '../dto/actualizar-perfil.dto.js';
import type { CambiarPasswordDto } from '../dto/cambiar-password.dto.js';
import type { PerfilDto } from '../dto/auth-response.dto.js';
import type { ActiveUser } from '../types/jwt-payload.type.js';

@Injectable()
export class PerfilService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly authService: AuthService,
    private readonly usuarioRepo: UsuarioRepository,
    private readonly clienteRepo: ClienteRepository,
  ) {}

  obtener(activeUser: ActiveUser): Promise<PerfilDto> {
    return this.authService.me(activeUser);
  }

  async actualizar(activeUser: ActiveUser, dto: ActualizarPerfilDto): Promise<PerfilDto> {
    await this.dataSource.transaction(async (manager) => {
      const usuario = await this.usuarioRepo.findById(activeUser.sub);
      if (!usuario) throw new NotFoundException('Usuario no encontrado');

      if (dto.nombre !== undefined) usuario.nombre = dto.nombre.trim();
      if (dto.apellido !== undefined) usuario.apellido = dto.apellido.trim();
      if (dto.telefono !== undefined) usuario.telefono = dto.telefono?.trim() || null;
      await this.usuarioRepo.save(usuario, manager);

      if (usuario.tipoUsuario === 'C' && dto.direccion !== undefined) {
        const cliente = await this.clienteRepo.findByUsuarioId(activeUser.sub, manager);
        if (cliente) {
          cliente.direccionPrincipal = dto.direccion?.trim() || null;
          await this.clienteRepo.save(cliente, manager);
        }
      }
    });

    return this.authService.me(activeUser);
  }

  async cambiarPassword(activeUser: ActiveUser, dto: CambiarPasswordDto): Promise<void> {
    const usuario = await this.usuarioRepo.findById(activeUser.sub);
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    const passwordValida = await bcrypt.compare(dto.passwordActual, usuario.passwordHash);
    if (!passwordValida) throw new BadRequestException('La contraseña actual no es correcta');

    usuario.passwordHash = await bcrypt.hash(dto.nuevaPassword, 10);
    await this.usuarioRepo.save(usuario);
  }
}
