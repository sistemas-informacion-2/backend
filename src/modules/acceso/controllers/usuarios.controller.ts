import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { UsuariosService } from '../services/usuarios.service.js';
import { CrearUsuarioDto } from '../dto/crear-usuario.dto.js';
import { ActualizarUsuarioDto } from '../dto/actualizar-usuario.dto.js';
import { GestionarRolesDto } from '../dto/gestionar-roles.dto.js';
import { UsuariosQueryDto } from '../dto/usuarios-query.dto.js';
import type { UsuarioResponseDto, UsuariosPaginatedResponseDto } from '../dto/usuario-response.dto.js';

@ApiTags('Usuarios')
@Controller('acceso/usuarios')
@RequirePermission('acceso:usuarios:gestionar')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  @ApiOperation({ summary: 'Lista usuarios con filtros y paginacion' })
  listar(@Query() query: UsuariosQueryDto): Promise<UsuariosPaginatedResponseDto> {
    return this.usuariosService.listar(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene un usuario por ID' })
  obtener(@Param('id', ParseIntPipe) id: number): Promise<UsuarioResponseDto> {
    return this.usuariosService.obtenerPorId(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crea un usuario' })
  crear(@Body() dto: CrearUsuarioDto): Promise<UsuarioResponseDto> {
    return this.usuariosService.crear(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualiza un usuario' })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarUsuarioDto,
  ): Promise<UsuarioResponseDto> {
    return this.usuariosService.actualizar(id, dto);
  }

  @Post(':id/roles')
  @ApiOperation({ summary: 'Reemplaza los roles activos de un usuario' })
  gestionarRoles(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GestionarRolesDto,
  ): Promise<UsuarioResponseDto> {
    return this.usuariosService.gestionarRoles(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desactiva logicamente un usuario' })
  async eliminar(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.usuariosService.eliminar(id);
  }
}
