import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import { VentasService } from '../services/ventas.service.js';
import { CrearVentaDto } from '../dto/crear-venta.dto.js';
import { VentasQueryDto } from '../dto/ventas-query.dto.js';
import type { VentaPaginatedResponseDto, VentaResponseDto } from '../dto/venta-response.dto.js';

@ApiTags('Comercial')
@Controller('comercial/ventas')
@RequirePermission('comercial:ventas:gestionar')
export class VentasController {
  constructor(private readonly ventasService: VentasService) {}

  @Get()
  @ApiOperation({ summary: 'Lista ventas presenciales con filtros y paginacion' })
  listar(@Query() query: VentasQueryDto): Promise<VentaPaginatedResponseDto> {
    return this.ventasService.listar(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene una venta con sus detalles y pagos' })
  obtener(@Param('id', ParseIntPipe) id: number): Promise<VentaResponseDto> {
    return this.ventasService.obtener(id);
  }

  @Post()
  @ApiOperation({ summary: 'Registra una venta presencial' })
  crear(@Body() dto: CrearVentaDto, @CurrentUser() usuario: ActiveUser): Promise<VentaResponseDto> {
    return this.ventasService.crear(dto, usuario);
  }
}
