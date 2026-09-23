import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireAnyPermission } from '../../../common/decorators/require-any-permission.decorator.js';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { AlmacenesService } from '../services/almacenes.service.js';
import { CrearAlmacenDto } from '../dto/crear-almacen.dto.js';
import { ActualizarAlmacenDto } from '../dto/actualizar-almacen.dto.js';
import { AlmacenesQueryDto } from '../dto/almacenes-query.dto.js';
import type { AlmacenResponseDto } from '../dto/almacen-response.dto.js';

@ApiTags('Inventario')
@Controller('inventario/almacenes')
@RequirePermission('inventario:almacen:gestionar')
export class AlmacenesController {
  constructor(private readonly almacenesService: AlmacenesService) {}

  @Get()
  @RequireAnyPermission('inventario:almacen:gestionar', 'inventario:almacen:leer')
  @ApiOperation({ summary: 'Lista almacenes con filtros por sucursal o estado' })
  listar(@Query() query: AlmacenesQueryDto): Promise<AlmacenResponseDto[]> {
    return this.almacenesService.listar(query);
  }

  @Get(':id')
  @RequireAnyPermission('inventario:almacen:gestionar', 'inventario:almacen:leer')
  @ApiOperation({ summary: 'Obtiene un almacen por ID' })
  obtener(@Param('id', ParseIntPipe) id: number): Promise<AlmacenResponseDto> {
    return this.almacenesService.obtener(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crea un almacen asociado a una sucursal' })
  crear(@Body() dto: CrearAlmacenDto): Promise<AlmacenResponseDto> {
    return this.almacenesService.crear(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualiza o desactiva un almacen' })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarAlmacenDto,
  ): Promise<AlmacenResponseDto> {
    return this.almacenesService.actualizar(id, dto);
  }
}
