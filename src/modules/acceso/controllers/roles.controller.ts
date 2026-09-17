import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireAnyPermission } from '../../../common/decorators/require-any-permission.decorator.js';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { ActualizarRolDto } from '../dto/actualizar-rol.dto.js';
import { CrearRolDto } from '../dto/crear-rol.dto.js';
import { GestionarPermisosDto } from '../dto/gestionar-permisos.dto.js';
import { RolesQueryDto } from '../dto/roles-query.dto.js';
import type { RolResponseDto } from '../dto/rol-response.dto.js';
import { RolesService } from '../services/roles.service.js';

@ApiTags('Roles')
@Controller('acceso/roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequireAnyPermission('acceso:usuarios:gestionar', 'acceso:roles:gestionar')
  @ApiOperation({ summary: 'Lista roles activos' })
  listar(@Query() query: RolesQueryDto): Promise<RolResponseDto[]> {
    return this.rolesService.listar(query);
  }

  @Get(':id')
  @RequirePermission('acceso:roles:gestionar')
  @ApiOperation({ summary: 'Obtiene el detalle de un rol' })
  obtener(@Param('id', ParseIntPipe) id: number): Promise<RolResponseDto> {
    return this.rolesService.obtenerPorId(id);
  }

  @Post()
  @RequirePermission('acceso:roles:gestionar')
  @ApiOperation({ summary: 'Crea un rol' })
  crear(@Body() dto: CrearRolDto): Promise<RolResponseDto> {
    return this.rolesService.crear(dto);
  }

  @Put(':id')
  @RequirePermission('acceso:roles:gestionar')
  @ApiOperation({ summary: 'Actualiza un rol' })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarRolDto,
  ): Promise<RolResponseDto> {
    return this.rolesService.actualizar(id, dto);
  }

  @Delete(':id')
  @RequirePermission('acceso:roles:gestionar')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desactiva logicamente un rol' })
  async eliminar(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.rolesService.eliminar(id);
  }

  @Get(':id/permisos')
  @RequirePermission('acceso:roles:gestionar')
  @ApiOperation({ summary: 'Lista los permisos activos de un rol' })
  listarPermisos(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.listarPermisosDelRol(id);
  }

  @Post(':id/permisos')
  @RequirePermission('acceso:roles:gestionar')
  @ApiOperation({ summary: 'Reemplaza los permisos de un rol' })
  gestionarPermisos(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GestionarPermisosDto,
  ): Promise<RolResponseDto> {
    return this.rolesService.gestionarPermisos(id, dto);
  }
}
