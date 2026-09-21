import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import { ComprasService } from '../services/compras.service.js';
import { CrearCompraDto } from '../dto/crear-compra.dto.js';
import { ComprasQueryDto } from '../dto/compras-query.dto.js';
import type { CompraResponseDto, ComprasPaginatedResponseDto } from '../dto/compra-response.dto.js';

@ApiTags('Comercial')
@Controller('comercial/compras')
@RequirePermission('comercial:compras:gestionar')
export class ComprasController {
  constructor(private readonly comprasService: ComprasService) {}

  @Get()
  @ApiOperation({ summary: 'Lista notas de compra con filtros por proveedor, sucursal, factura y fechas' })
  listar(@Query() query: ComprasQueryDto, @CurrentUser() usuario: ActiveUser): Promise<ComprasPaginatedResponseDto> {
    return this.comprasService.listar(query, usuario);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene una nota de compra con sus lineas' })
  obtener(@Param('id', ParseIntPipe) id: number, @CurrentUser() usuario: ActiveUser): Promise<CompraResponseDto> {
    return this.comprasService.obtener(id, usuario);
  }

  @Post()
  @ApiOperation({ summary: 'Registra una compra, suma el stock a los almacenes y, opcionalmente, egresa de caja' })
  registrar(@Body() dto: CrearCompraDto, @CurrentUser() usuario: ActiveUser): Promise<CompraResponseDto> {
    return this.comprasService.registrar(dto, usuario);
  }
}
