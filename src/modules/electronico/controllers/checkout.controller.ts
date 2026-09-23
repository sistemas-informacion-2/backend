import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import { CheckoutService } from '../services/checkout.service.js';
import {
  CapturarPaypalDto,
  ConfirmarQrDto,
  PagoTarjetaDto,
  type CompraOnlineResponseDto,
  type IniciarPaypalResponseDto,
  type IniciarQrResponseDto,
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

  @Post('paypal/orden')
  @ApiOperation({ summary: 'Crea la orden de PayPal por el total del carrito y devuelve la pagina de aprobacion' })
  iniciarPaypal(@CurrentUser() usuario: ActiveUser): Promise<IniciarPaypalResponseDto> {
    return this.checkoutService.iniciarPaypal(usuario);
  }

  @Post('paypal/capturar')
  @ApiOperation({ summary: 'Cobra la orden aprobada en PayPal y registra la compra' })
  capturarPaypal(@Body() dto: CapturarPaypalDto, @CurrentUser() usuario: ActiveUser): Promise<CompraOnlineResponseDto> {
    return this.checkoutService.capturarPaypal(usuario, dto.orderId);
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

  @Post('reservas/:idReserva/paypal/orden')
  @ApiOperation({ summary: 'Crea la orden de PayPal por el anticipo de una reserva propia' })
  iniciarPaypalReserva(@Param('idReserva', ParseIntPipe) idReserva: number, @CurrentUser() usuario: ActiveUser): Promise<IniciarPaypalResponseDto> {
    return this.checkoutService.iniciarPaypal(usuario, idReserva);
  }

  @Post('reservas/:idReserva/paypal/capturar')
  @ApiOperation({ summary: 'Cobra el anticipo aprobado en PayPal y deja la reserva PAGADA' })
  capturarPaypalReserva(
    @Param('idReserva', ParseIntPipe) idReserva: number,
    @Body() dto: CapturarPaypalDto,
    @CurrentUser() usuario: ActiveUser,
  ): Promise<CompraOnlineResponseDto> {
    return this.checkoutService.capturarPaypal(usuario, dto.orderId, idReserva);
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
