import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import { VentasEnLineaService } from '../services/ventas-en-linea.service.js';
import { VentasQueryDto } from '../dto/ventas-query.dto.js';
import type { VentaPaginatedResponseDto, VentaResponseDto } from '../dto/venta-response.dto.js';

/** Consulta de las notas de venta de la tienda en linea. Solo lectura: las compras las crea el checkout del cliente. */
@ApiTags('Electronico')
@Controller('electronico/ventas')
@RequirePermission('electronico:ventas:leer')
export class VentasEnLineaController {
  constructor(private readonly ventasEnLineaService: VentasEnLineaService) {}

  @Get()
  @ApiOperation({ summary: 'Lista las notas de venta de compras en linea con filtros y paginacion' })
  listar(@Query() query: VentasQueryDto, @CurrentUser() usuario: ActiveUser): Promise<VentaPaginatedResponseDto> {
    return this.ventasEnLineaService.listar(query, usuario);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene una nota de venta en linea con sus detalles y pagos' })
  obtener(@Param('id', ParseIntPipe) id: number, @CurrentUser() usuario: ActiveUser): Promise<VentaResponseDto> {
    return this.ventasEnLineaService.obtener(id, usuario);
  }
}
