import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import { DevolucionesService } from '../services/devoluciones.service.js';
import {
  CrearDevolucionDto,
  DevolucionesQueryDto,
  OrigenDevolucionQueryDto,
  type DevolucionesPaginatedResponseDto,
  type DevolucionResponseDto,
  type OrigenDevolucionResponseDto,
} from '../dto/devoluciones.dto.js';

@ApiTags('Comercial')
@Controller('comercial/devoluciones')
@RequirePermission('comercial:devoluciones:gestionar')
export class DevolucionesController {
  constructor(private readonly devolucionesService: DevolucionesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista devoluciones con filtros y paginacion' })
  listar(@Query() query: DevolucionesQueryDto, @CurrentUser() usuario: ActiveUser): Promise<DevolucionesPaginatedResponseDto> {
    return this.devolucionesService.listar(query, usuario);
  }

  @Get('origen')
  @ApiOperation({ summary: 'Busca la nota de venta o reserva a devolver y lo que aun se puede reembolsar' })
  origen(@Query() query: OrigenDevolucionQueryDto): Promise<OrigenDevolucionResponseDto> {
    return this.devolucionesService.buscarOrigen(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene una devolucion con sus lineas' })
  obtener(@Param('id', ParseIntPipe) id: number, @CurrentUser() usuario: ActiveUser): Promise<DevolucionResponseDto> {
    return this.devolucionesService.obtener(id, usuario);
  }

  @Post()
  @ApiOperation({ summary: 'Registra una devolucion: reembolso en caja y destino de las prendas' })
  crear(@Body() dto: CrearDevolucionDto, @CurrentUser() usuario: ActiveUser): Promise<DevolucionResponseDto> {
    return this.devolucionesService.crear(dto, usuario);
  }
}
