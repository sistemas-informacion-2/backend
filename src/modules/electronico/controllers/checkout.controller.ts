import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import { CheckoutService } from '../services/checkout.service.js';
import {
  ConfirmarQrDto,
  ConfirmarStripeDto,
  PagoTarjetaDto,
  type CompraOnlineResponseDto,
  type IniciarQrResponseDto,
  type IniciarStripeResponseDto,
  type MetodoPagoOnlineDto,
} from '../dto/checkout.dto.js';

/**
 * Pago en linea del cliente autenticado (CU14): el carrito y, con las rutas `reservas/:idReserva/...`, el anticipo
 * de una reserva. Sin permiso asignable: el servicio exige que sea cliente y opera solo sobre lo suyo (id del JWT).
 */
@ApiTags('Electronico')
@Controller('electronico/checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Get('metodos')
  @ApiOperation({ summary: 'Metodos de pago en linea disponibles (CU17)' })
  metodos(@CurrentUser() usuario: ActiveUser): Promise<MetodoPagoOnlineDto[]> {
    return this.checkoutService.metodos(usuario);
  }

  // --- Carrito ---

  @Post('stripe/sesion')
  @ApiOperation({ summary: 'Crea la sesion de Stripe Checkout por el total del carrito y devuelve la pagina de pago' })
  iniciarStripe(@CurrentUser() usuario: ActiveUser): Promise<IniciarStripeResponseDto> {
    return this.checkoutService.iniciarStripe(usuario);
  }

  @Post('stripe/confirmar')
  @ApiOperation({ summary: 'Cobra el pago autorizado en Stripe y registra la compra' })
  confirmarStripe(@Body() dto: ConfirmarStripeDto, @CurrentUser() usuario: ActiveUser): Promise<CompraOnlineResponseDto> {
    return this.checkoutService.confirmarStripe(usuario, dto.sessionId);
  }

  @Post('qr')
  @ApiOperation({ summary: 'Genera el QR de cobro por el total del carrito (simulado)' })
  iniciarQr(@CurrentUser() usuario: ActiveUser): Promise<IniciarQrResponseDto> {
    return this.checkoutService.iniciarQr(usuario);
  }

  @Post('qr/confirmar')
  @ApiOperation({ summary: 'Confirma el pago del QR y registra la compra (simulado)' })
  confirmarQr(@Body() dto: ConfirmarQrDto, @CurrentUser() usuario: ActiveUser): Promise<CompraOnlineResponseDto> {
    return this.checkoutService.confirmarQr(usuario, dto.referencia);
  }

  @Post('tarjeta')
  @ApiOperation({ summary: 'Paga el carrito con tarjeta (simulado); los datos de la tarjeta no se guardan' })
  pagarTarjeta(@Body() dto: PagoTarjetaDto, @CurrentUser() usuario: ActiveUser): Promise<CompraOnlineResponseDto> {
    return this.checkoutService.pagarTarjeta(usuario, dto);
  }

  // --- Anticipo de una reserva ---

  @Post('reservas/:idReserva/stripe/sesion')
  @ApiOperation({ summary: 'Crea la sesion de Stripe Checkout por el anticipo de una reserva propia' })
  iniciarStripeReserva(@Param('idReserva', ParseIntPipe) idReserva: number, @CurrentUser() usuario: ActiveUser): Promise<IniciarStripeResponseDto> {
    return this.checkoutService.iniciarStripe(usuario, idReserva);
  }

  @Post('reservas/:idReserva/stripe/confirmar')
  @ApiOperation({ summary: 'Cobra el anticipo autorizado en Stripe y deja la reserva PAGADA' })
  confirmarStripeReserva(
    @Param('idReserva', ParseIntPipe) idReserva: number,
    @Body() dto: ConfirmarStripeDto,
    @CurrentUser() usuario: ActiveUser,
  ): Promise<CompraOnlineResponseDto> {
    return this.checkoutService.confirmarStripe(usuario, dto.sessionId, idReserva);
  }

  @Post('reservas/:idReserva/qr')
  @ApiOperation({ summary: 'Genera el QR de cobro por el anticipo de una reserva propia (simulado)' })
  iniciarQrReserva(@Param('idReserva', ParseIntPipe) idReserva: number, @CurrentUser() usuario: ActiveUser): Promise<IniciarQrResponseDto> {
    return this.checkoutService.iniciarQr(usuario, idReserva);
  }

  @Post('reservas/:idReserva/qr/confirmar')
  @ApiOperation({ summary: 'Confirma el pago del QR del anticipo y deja la reserva PAGADA (simulado)' })
  confirmarQrReserva(
    @Param('idReserva', ParseIntPipe) idReserva: number,
    @Body() dto: ConfirmarQrDto,
    @CurrentUser() usuario: ActiveUser,
  ): Promise<CompraOnlineResponseDto> {
    return this.checkoutService.confirmarQr(usuario, dto.referencia, idReserva);
  }

  @Post('reservas/:idReserva/tarjeta')
  @ApiOperation({ summary: 'Paga el anticipo de una reserva propia con tarjeta (simulado)' })
  pagarTarjetaReserva(
    @Param('idReserva', ParseIntPipe) idReserva: number,
    @Body() dto: PagoTarjetaDto,
    @CurrentUser() usuario: ActiveUser,
  ): Promise<CompraOnlineResponseDto> {
    return this.checkoutService.pagarTarjeta(usuario, dto, idReserva);
  }
}
