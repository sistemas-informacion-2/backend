import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { PermisosService } from '../services/permisos.service.js';

@ApiTags('Permisos')
@Controller('acceso/permisos')
@RequirePermission('acceso:roles:gestionar')
export class PermisosController {
  constructor(private readonly permisosService: PermisosService) {}

  @Get()
  @ApiOperation({ summary: 'Lista el catalogo de permisos agrupado por modulo' })
  listar() {
    return this.permisosService.listarAgrupados();
  }
}
