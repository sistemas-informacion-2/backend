import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { RequierePlan } from '../../../common/decorators/plan.decorator.js';
import { BiEstadoService, type EstadoBiDto } from '../services/bi-estado.service.js';

@ApiTags('BI')
@RequierePlan('bi')
@Controller('bi')
@RequirePermission('analitica:bi:usar')
export class BiEstadoController {
  constructor(private readonly estadoService: BiEstadoService) {}

  @Get('estado')
  @ApiOperation({ summary: 'Estado del BI: IA configurada, Data Warehouse y ultima carga de datos' })
  estado(): Promise<EstadoBiDto> {
    return this.estadoService.estado();
  }
}
