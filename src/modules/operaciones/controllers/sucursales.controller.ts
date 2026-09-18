import { Body, Controller, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { SucursalesService } from '../services/sucursales.service.js';
import { CrearSucursalDto } from '../dto/crear-sucursal.dto.js';
import { ActualizarSucursalDto } from '../dto/actualizar-sucursal.dto.js';
import type { SucursalResponseDto } from '../dto/sucursal-response.dto.js';

@ApiTags('Operaciones')
@Controller('operaciones/sucursales')
export class SucursalesController {
  constructor(private readonly sucursalesService: SucursalesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista todas las sucursales con su ciudad y departamento' })
  listar(): Promise<SucursalResponseDto[]> {
    return this.sucursalesService.listar();
  }

  @Post()
  @RequirePermission('operaciones:sucursales:gestionar')
  @ApiOperation({ summary: 'Crea una sucursal' })
  crear(@Body() dto: CrearSucursalDto): Promise<SucursalResponseDto> {
    return this.sucursalesService.crear(dto);
  }

  @Put(':id')
  @RequirePermission('operaciones:sucursales:gestionar')
  @ApiOperation({ summary: 'Actualiza datos de contacto/horario o deshabilita una sucursal' })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarSucursalDto,
  ): Promise<SucursalResponseDto> {
    return this.sucursalesService.actualizar(id, dto);
  }
}
