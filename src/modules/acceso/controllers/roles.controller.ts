import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { RolesService } from '../services/roles.service.js';

@ApiTags('Roles')
@Controller('acceso/roles')
@RequirePermission('acceso:usuarios:gestionar')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista roles activos para asignacion de usuarios' })
  listarActivos(): Promise<Array<{ id: number; nombre: string }>> {
    return this.rolesService.listarActivos();
  }
}
