import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import { CajaService } from '../services/caja.service.js';
import { AbrirCajaDto } from '../dto/abrir-caja.dto.js';
import { CerrarCajaDto } from '../dto/cerrar-caja.dto.js';
import { CrearMovimientoCajaDto } from '../dto/crear-movimiento-caja.dto.js';
import { CajasQueryDto } from '../dto/cajas-query.dto.js';
import { CajaAbiertaQueryDto } from '../dto/caja-abierta-query.dto.js';
import type { CajaResponseDto } from '../dto/caja-response.dto.js';
import type { MovimientoCajaResponseDto } from '../dto/movimiento-caja-response.dto.js';

@ApiTags('Comercial')
@Controller('comercial/cajas')
@RequirePermission('comercial:caja:gestionar')
export class CajasController {
  constructor(private readonly cajaService: CajaService) {}

  @Get()
  @ApiOperation({ summary: 'Lista cajas con filtros por sucursal, estado y fechas' })
  listar(@Query() query: CajasQueryDto): Promise<CajaResponseDto[]> {
    return this.cajaService.listar(query);
  }

  @Get('abierta')
  @ApiOperation({ summary: 'Obtiene la caja abierta de una sucursal (o null)' })
  abierta(@Query() query: CajaAbiertaQueryDto): Promise<CajaResponseDto | null> {
    return this.cajaService.abierta(query.idSucursal);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene una caja con sus movimientos y totales' })
  obtener(@Param('id', ParseIntPipe) id: number): Promise<CajaResponseDto> {
    return this.cajaService.obtener(id);
  }

  @Get(':id/movimientos')
  @ApiOperation({ summary: 'Lista los movimientos de una caja' })
  listarMovimientos(@Param('id', ParseIntPipe) id: number): Promise<MovimientoCajaResponseDto[]> {
    return this.cajaService.listarMovimientos(id);
  }

  @Post()
  @ApiOperation({ summary: 'Abre una caja para una sucursal' })
  abrir(@Body() dto: AbrirCajaDto, @CurrentUser() usuario: ActiveUser): Promise<CajaResponseDto> {
    return this.cajaService.abrir(dto, usuario);
  }

  @Post(':id/movimientos')
  @ApiOperation({ summary: 'Registra un ingreso o egreso en una caja abierta' })
  registrarMovimiento(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CrearMovimientoCajaDto,
  ): Promise<MovimientoCajaResponseDto> {
    return this.cajaService.registrarMovimiento(id, dto);
  }

  @Patch(':id/cerrar')
  @ApiOperation({ summary: 'Cierra una caja calculando el monto final' })
  cerrar(@Param('id', ParseIntPipe) id: number, @Body() dto: CerrarCajaDto): Promise<CajaResponseDto> {
    return this.cajaService.cerrar(id, dto);
  }
}
