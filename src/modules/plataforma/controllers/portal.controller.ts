import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../../common/decorators/public.decorator.js';
import { SoloPlataforma } from '../../../common/decorators/solo-plataforma.decorator.js';
import type { PlanResponseDto } from '../dto/plan.dto.js';
import {
  ConfirmarPagoDto,
  IngresoTiendasDto,
  RegistroEmpresaDto,
  type RegistroResponseDto,
  type SlugDisponibleResponseDto,
  type TiendaCreadaDto,
  type TiendaDeUsuarioDto,
} from '../dto/registro.dto.js';
import { IngresoService } from '../services/ingreso.service.js';
import { PlanesService } from '../services/planes.service.js';
import { RegistroService } from '../services/registro.service.js';

/**
 * Portal publico de DOMINATR (sin token y sin tienda): planes, registro de empresas y el login con correo que
 * dice en que tiendas puede entrar alguien.
 */
@ApiTags('Portal')
@SoloPlataforma()
@Public()
@Controller('plataforma')
export class PortalController {
  constructor(
    private readonly planes: PlanesService,
    private readonly registro: RegistroService,
    private readonly ingreso: IngresoService,
  ) {}

  @Get('planes')
  @ApiOperation({ summary: 'Planes que ofrece DOMINATR, en el orden de las tarjetas' })
  listarPlanes(): Promise<PlanResponseDto[]> {
    return this.planes.listarActivos();
  }

  @Get('registro/slug-disponible')
  @ApiOperation({ summary: 'Dice si una direccion de tienda (/t/:slug) esta libre' })
  slugDisponible(@Query('slug') slug: string): Promise<SlugDisponibleResponseDto> {
    return this.registro.slugDisponible(slug);
  }

  @Post('registro')
  @ApiOperation({ summary: 'Registra una empresa: con la prueba gratuita la crea al instante; con un plan de pago devuelve el enlace de Stripe' })
  registrar(@Body() dto: RegistroEmpresaDto, @Req() req: Request): Promise<RegistroResponseDto> {
    return this.registro.registrar(dto, req.ip ?? null);
  }

  @Post('registro/confirmar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirma el pago de Stripe de un registro y crea la tienda (idempotente)' })
  confirmarRegistro(@Body() dto: ConfirmarPagoDto): Promise<TiendaCreadaDto> {
    return this.registro.confirmar(dto.sessionId);
  }

  @Post('ingreso/tiendas')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tiendas donde un correo y una contrasena del personal son validos (login desde el portal)' })
  tiendas(@Body() dto: IngresoTiendasDto, @Req() req: Request): Promise<TiendaDeUsuarioDto[]> {
    return this.ingreso.tiendas(dto, req.ip ?? null);
  }
}
