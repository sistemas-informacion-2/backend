import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { RolesService } from '../services/roles.service.js';
import { CrearRolDto } from '../dto/crear-rol.dto.js';
import { ActualizarRolDto } from '../dto/actualizar-rol.dto.js';
import { GestionarPermisosRolDto } from '../dto/gestionar-permisos-rol.dto.js';
import { RolesQueryDto } from '../dto/roles-query.dto.js';
import type { PermisoResponseDto, RolResponseDto } from '../dto/rol-response.dto.js';

@ApiTags('Roles')
@Controller('acceso/roles')
@RequirePermission('acceso:roles:gestionar')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista roles con filtros de búsqueda y estado' })
  listar(@Query() query: RolesQueryDto): Promise<RolResponseDto[]> {
    return this.rolesService.listar(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene un rol por ID' })
  obtener(@Param('id', ParseIntPipe) id: number): Promise<RolResponseDto> {
    return this.rolesService.obtener(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crea un rol' })
  crear(@Body() dto: CrearRolDto): Promise<RolResponseDto> {
    return this.rolesService.crear(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualiza un rol' })
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarRolDto): Promise<RolResponseDto> {
    return this.rolesService.actualizar(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desactiva lógicamente un rol' })
  async eliminar(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.rolesService.desactivar(id);
  }

  @Get(':id/permisos')
  @ApiOperation({ summary: 'Lista los permisos asignados a un rol' })
  listarPermisos(@Param('id', ParseIntPipe) id: number): Promise<PermisoResponseDto[]> {
    return this.rolesService.listarPermisosDeRol(id);
  }

  @Post(':id/permisos')
  @ApiOperation({ summary: 'Reemplaza los permisos asignados a un rol' })
  gestionarPermisos(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GestionarPermisosRolDto,
  ): Promise<RolResponseDto> {
    return this.rolesService.gestionarPermisos(id, dto);
  }
}
