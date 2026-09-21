import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireAnyPermission } from '../../../common/decorators/require-any-permission.decorator.js';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { PasarelasService } from '../services/pasarelas.service.js';
import { CrearPasarelaDto } from '../dto/crear-pasarela.dto.js';
import { ActualizarPasarelaDto } from '../dto/actualizar-pasarela.dto.js';
import { ActualizarDisponibilidadPasarelaDto } from '../dto/actualizar-disponibilidad-pasarela.dto.js';
import { PasarelasQueryDto } from '../dto/pasarelas-query.dto.js';
import type { PasarelaResponseDto } from '../dto/pasarela-response.dto.js';

@ApiTags('Comercial')
@Controller('comercial/pasarelas')
export class PasarelasController {
  constructor(private readonly pasarelasService: PasarelasService) {}

  @Get()
  @RequirePermission('comercial:pasarelas:gestionar')
  @ApiOperation({ summary: 'Lista metodos de pago con filtros (uso administrativo)' })
  listar(@Query() query: PasarelasQueryDto): Promise<PasarelaResponseDto[]> {
    return this.pasarelasService.listar(query);
  }

  @Get('presencial')
  @RequireAnyPermission('comercial:pasarelas:gestionar', 'comercial:pasarelas:leer')
  @ApiOperation({ summary: 'Lista los metodos habilitados para cobrar en caja (presencial)' })
  listarPresencial(): Promise<PasarelaResponseDto[]> {
    return this.pasarelasService.listarPresencial();
  }

  @Get('linea')
  @RequireAnyPermission('comercial:pasarelas:gestionar', 'comercial:pasarelas:leer')
  @ApiOperation({ summary: 'Lista los metodos habilitados para cobrar en linea (e-commerce)' })
  listarLinea(): Promise<PasarelaResponseDto[]> {
    return this.pasarelasService.listarLinea();
  }

  @Get(':id')
  @RequirePermission('comercial:pasarelas:gestionar')
  @ApiOperation({ summary: 'Obtiene un metodo de pago por ID' })
  obtener(@Param('id', ParseIntPipe) id: number): Promise<PasarelaResponseDto> {
    return this.pasarelasService.obtener(id);
  }

  @Post()
  @RequirePermission('comercial:pasarelas:gestionar')
  @ApiOperation({ summary: 'Crea un metodo de pago' })
  crear(@Body() dto: CrearPasarelaDto): Promise<PasarelaResponseDto> {
    return this.pasarelasService.crear(dto);
  }

  @Put(':id')
  @RequirePermission('comercial:pasarelas:gestionar')
  @ApiOperation({ summary: 'Actualiza un metodo de pago' })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarPasarelaDto,
  ): Promise<PasarelaResponseDto> {
    return this.pasarelasService.actualizar(id, dto);
  }

  @Patch(':id/disponibilidad')
  @RequirePermission('comercial:pasarelas:gestionar')
  @ApiOperation({ summary: 'Habilita o deshabilita un metodo por canal (presencial / linea)' })
  cambiarDisponibilidad(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarDisponibilidadPasarelaDto,
  ): Promise<PasarelaResponseDto> {
    return this.pasarelasService.cambiarDisponibilidad(id, dto);
  }
}
