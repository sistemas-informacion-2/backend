import { Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { PermitidoSinPlan } from '../../../common/decorators/plan.decorator.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import { PagarPlanDto } from '../dto/plan.dto.js';
import { ConfirmarPagoDto } from '../dto/registro.dto.js';
import type { IniciarPagoResponseDto, MiPlanResponseDto, PagoConfirmadoResponseDto } from '../dto/suscripcion.dto.js';
import { SuscripcionService } from '../services/suscripcion.service.js';

/**
 * Mi plan, dentro de una tienda. Sigue abierto con el plan vencido: es por donde se renueva. Lo ve el personal de
 * la tienda; pagar es solo del administrador.
 */
@ApiTags('Suscripcion')
@PermitidoSinPlan()
@Controller('suscripcion')
export class SuscripcionController {
  constructor(private readonly suscripcion: SuscripcionService) {}

  @Get()
  @ApiOperation({ summary: 'Plan de la tienda, vigencia, uso de los limites y ultimos pagos' })
  miPlan(@CurrentUser() usuario: ActiveUser): Promise<MiPlanResponseDto> {
    soloPersonal(usuario);
    return this.suscripcion.miPlan(usuario);
  }

  @Post('pagar')
  @ApiOperation({ summary: 'Abre el pago con Stripe de otro periodo (mismo plan) o de un cambio de plan' })
  pagar(@Body() dto: PagarPlanDto, @CurrentUser() usuario: ActiveUser): Promise<IniciarPagoResponseDto> {
    soloPersonal(usuario);
    return this.suscripcion.iniciarPago(dto, usuario);
  }

  @Post('confirmar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirma el pago de Stripe y extiende o cambia el plan (idempotente)' })
  confirmar(@Body() dto: ConfirmarPagoDto, @CurrentUser() usuario: ActiveUser): Promise<PagoConfirmadoResponseDto> {
    soloPersonal(usuario);
    return this.suscripcion.confirmarPago(dto.sessionId);
  }
}

function soloPersonal(usuario: ActiveUser): void {
  if (usuario.tipoUsuario !== 'A' && usuario.tipoUsuario !== 'E') throw new ForbiddenException('Solo el personal de la tienda ve su plan');
}
