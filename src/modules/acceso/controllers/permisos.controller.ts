import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { RolesService } from '../services/roles.service.js';
import type { PermisoGrupoResponseDto } from '../dto/rol-response.dto.js';

@ApiTags('Permisos')
@Controller('acceso/permisos')
@RequirePermission('acceso:roles:gestionar')
export class PermisosController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista el catálogo de permisos activos agrupado por módulo' })
  listarAgrupados(): Promise<PermisoGrupoResponseDto[]> {
    return this.rolesService.listarPermisosAgrupados();
  }
}
