import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import { ReservasService } from '../services/reservas.service.js';
import {
  CancelarReservaDto,
  CrearReservaDto,
  LiquidarReservaDto,
  RegistrarAnticipoDto,
  ReservasQueryDto,
  type ReservaResponseDto,
  type ReservasPaginatedResponseDto,
} from '../dto/reservas.dto.js';

const PERMISO = 'electronico:reservas:gestionar';

/**
 * Reservas (CU23). Las rutas `mias/*` son del cliente autenticado (sin permiso asignable: el servicio
 * toma su id del JWT y nunca del cuerpo); el resto es para el personal y exige `electronico:reservas:gestionar`.
 */
@ApiTags('Electronico')
@Controller('electronico/reservas')
export class ReservasController {
  constructor(private readonly reservasService: ReservasService) {}

  @Get('mias')
  @ApiOperation({ summary: 'Reservas del cliente autenticado' })
  mias(@CurrentUser() usuario: ActiveUser): Promise<ReservaResponseDto[]> {
    return this.reservasService.misReservas(usuario);
  }

  @Post('mias')
  @ApiOperation({ summary: 'El cliente aparta prendas en una sucursal (queda PENDIENTE hasta cobrar el anticipo)' })
  crearMia(@Body() dto: CrearReservaDto, @CurrentUser() usuario: ActiveUser): Promise<ReservaResponseDto> {
    return this.reservasService.crearPropia(dto, usuario);
  }

  @Get('mias/:id')
  @ApiOperation({ summary: 'Detalle de una reserva propia' })
  obtenerMia(@Param('id', ParseIntPipe) id: number, @CurrentUser() usuario: ActiveUser): Promise<ReservaResponseDto> {
    return this.reservasService.obtenerPropia(id, usuario);
  }

  @Post('mias/:id/cancelar')
  @ApiOperation({ summary: 'El cliente cancela su reserva y libera el stock' })
  cancelarMia(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelarReservaDto,
    @CurrentUser() usuario: ActiveUser,
  ): Promise<ReservaResponseDto> {
    return this.reservasService.cancelarPropia(id, dto, usuario);
  }

  @Get()
  @RequirePermission(PERMISO)
  @ApiOperation({ summary: 'Lista reservas con filtros y paginacion' })
  listar(@Query() query: ReservasQueryDto, @CurrentUser() usuario: ActiveUser): Promise<ReservasPaginatedResponseDto> {
    return this.reservasService.listar(query, usuario);
  }

  @Get(':id')
  @RequirePermission(PERMISO)
  @ApiOperation({ summary: 'Obtiene una reserva con sus lineas y pagos' })
  obtener(@Param('id', ParseIntPipe) id: number, @CurrentUser() usuario: ActiveUser): Promise<ReservaResponseDto> {
    return this.reservasService.obtener(id, usuario);
  }

  @Post()
  @RequirePermission(PERMISO)
  @ApiOperation({ summary: 'Crea una reserva presencial para un cliente' })
  crear(@Body() dto: CrearReservaDto, @CurrentUser() usuario: ActiveUser): Promise<ReservaResponseDto> {
    return this.reservasService.crear(dto, usuario);
  }

  @Post(':id/anticipo')
  @RequirePermission(PERMISO)
  @ApiOperation({ summary: 'Cobra el anticipo en caja; la reserva pasa a PAGADA' })
  anticipo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RegistrarAnticipoDto,
    @CurrentUser() usuario: ActiveUser,
  ): Promise<ReservaResponseDto> {
    return this.reservasService.registrarAnticipo(id, dto, usuario);
  }

  @Post(':id/liquidar')
  @RequirePermission(PERMISO)
  @ApiOperation({ summary: 'Cobra el saldo, emite la nota de venta y completa la reserva' })
  liquidar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: LiquidarReservaDto,
    @CurrentUser() usuario: ActiveUser,
  ): Promise<ReservaResponseDto> {
    return this.reservasService.liquidar(id, dto, usuario);
  }

  @Post(':id/cancelar')
  @RequirePermission(PERMISO)
  @ApiOperation({ summary: 'Cancela la reserva y libera el stock apartado' })
  cancelar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelarReservaDto,
    @CurrentUser() usuario: ActiveUser,
  ): Promise<ReservaResponseDto> {
    return this.reservasService.cancelar(id, dto, usuario);
  }
}
