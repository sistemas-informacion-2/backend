import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { ProveedoresService } from '../services/proveedores.service.js';
import { CrearProveedorDto } from '../dto/crear-proveedor.dto.js';
import { ActualizarProveedorDto } from '../dto/actualizar-proveedor.dto.js';
import { ProveedoresQueryDto } from '../dto/proveedores-query.dto.js';
import type { ProveedorResponseDto } from '../dto/proveedor-response.dto.js';

@ApiTags('Inventario')
@Controller('inventario/proveedores')
@RequirePermission('inventario:proveedores:gestionar')
export class ProveedoresController {
  constructor(private readonly proveedoresService: ProveedoresService) {}

  @Get()
  @ApiOperation({ summary: 'Lista proveedores con filtros por NIT, razón social o contacto' })
  listar(@Query() query: ProveedoresQueryDto): Promise<ProveedorResponseDto[]> {
    return this.proveedoresService.listar(query);
  }

  @Post()
  @ApiOperation({ summary: 'Crea un proveedor' })
  crear(@Body() dto: CrearProveedorDto): Promise<ProveedorResponseDto> {
    return this.proveedoresService.crear(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualiza o desactiva un proveedor' })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarProveedorDto,
  ): Promise<ProveedorResponseDto> {
    return this.proveedoresService.actualizar(id, dto);
  }
}
