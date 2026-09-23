import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import { DevolucionesService } from '../services/devoluciones.service.js';
import { VentasService } from '../services/ventas.service.js';
import { PaginacionClienteQueryDto } from '../dto/paginacion-cliente-query.dto.js';
import type { DevolucionesPaginatedResponseDto, DevolucionResponseDto } from '../dto/devoluciones.dto.js';
import type { VentaPaginatedResponseDto, VentaResponseDto } from '../dto/venta-response.dto.js';

/**
 * Compras y devoluciones del cliente autenticado ("Mi cuenta"). Sin permiso asignable: los servicios exigen
 * que el usuario sea cliente y siempre filtran por su propio id (tomado del JWT, nunca de la peticion).
 */
@ApiTags('Comercial')
@Controller('comercial/mi-cuenta')
export class CuentaClienteController {
  constructor(
    private readonly ventasService: VentasService,
    private readonly devolucionesService: DevolucionesService,
  ) {}

  @Get('compras')
  @ApiOperation({ summary: 'Compras (notas de venta) del cliente autenticado' })
  compras(@Query() query: PaginacionClienteQueryDto, @CurrentUser() usuario: ActiveUser): Promise<VentaPaginatedResponseDto> {
    return this.ventasService.listarPropias(query, usuario);
  }

  @Get('compras/:id')
  @ApiOperation({ summary: 'Detalle de una compra propia' })
  compra(@Param('id', ParseIntPipe) id: number, @CurrentUser() usuario: ActiveUser): Promise<VentaResponseDto> {
    return this.ventasService.obtenerPropia(id, usuario);
  }

  @Get('devoluciones')
  @ApiOperation({ summary: 'Devoluciones del cliente autenticado' })
  devoluciones(@Query() query: PaginacionClienteQueryDto, @CurrentUser() usuario: ActiveUser): Promise<DevolucionesPaginatedResponseDto> {
    return this.devolucionesService.listarPropias(query, usuario);
  }

  @Get('devoluciones/:id')
  @ApiOperation({ summary: 'Detalle de una devolucion propia' })
  devolucion(@Param('id', ParseIntPipe) id: number, @CurrentUser() usuario: ActiveUser): Promise<DevolucionResponseDto> {
    return this.devolucionesService.obtenerPropia(id, usuario);
  }
}
