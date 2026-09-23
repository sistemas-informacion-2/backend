import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireAnyPermission } from '../../../common/decorators/require-any-permission.decorator.js';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { InventarioService } from '../services/inventario.service.js';
import { CrearStockDto } from '../dto/crear-stock.dto.js';
import { ActualizarStockDto } from '../dto/actualizar-stock.dto.js';
import { AjustarStockDto } from '../dto/ajustar-stock.dto.js';
import { InventarioQueryDto } from '../dto/inventario-query.dto.js';
import type { InventarioPaginatedResponseDto, InventarioResponseDto } from '../dto/inventario-response.dto.js';

@ApiTags('Inventario')
@Controller('inventario/stock')
@RequirePermission('inventario:almacen:gestionar')
export class InventarioController {
  constructor(private readonly inventarioService: InventarioService) {}

  @Get()
  @RequireAnyPermission('inventario:almacen:gestionar', 'inventario:almacen:leer')
  @ApiOperation({ summary: 'Lista existencias con filtros por almacen, sucursal o bajo minimo' })
  listar(@Query() query: InventarioQueryDto): Promise<InventarioPaginatedResponseDto> {
    return this.inventarioService.listar(query);
  }

  @Get(':id')
  @RequireAnyPermission('inventario:almacen:gestionar', 'inventario:almacen:leer')
  @ApiOperation({ summary: 'Obtiene un registro de inventario por ID' })
  obtener(@Param('id', ParseIntPipe) id: number): Promise<InventarioResponseDto> {
    return this.inventarioService.obtener(id);
  }

  @Post()
  @ApiOperation({ summary: 'Registra una variante en un almacen' })
  registrar(@Body() dto: CrearStockDto): Promise<InventarioResponseDto> {
    return this.inventarioService.registrar(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualiza los niveles minimo y maximo de stock' })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarStockDto,
  ): Promise<InventarioResponseDto> {
    return this.inventarioService.actualizar(id, dto);
  }

  @Patch(':id/ajuste')
  @ApiOperation({ summary: 'Registra una entrada, salida o ajuste absoluto de stock' })
  ajustar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AjustarStockDto,
  ): Promise<InventarioResponseDto> {
    return this.inventarioService.ajustar(id, dto);
  }
}
