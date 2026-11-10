import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator.js';
import { SoloPlataforma } from '../../../common/decorators/solo-plataforma.decorator.js';
import { EmpresasService } from '../services/empresas.service.js';
import {
  ActualizarEmpresaDto,
  CambiarEstadoEmpresaDto,
  CrearEmpresaDto,
  type EmpresaPublicaResponseDto,
  type EmpresaResponseDto,
} from '../dto/empresa.dto.js';

@ApiTags('Plataforma')
@SoloPlataforma()
@Controller('plataforma/empresas')
export class EmpresasController {
  constructor(private readonly empresasService: EmpresasService) {}

  @Get()
  @ApiOperation({ summary: 'Lista las empresas de la plataforma' })
  listar(): Promise<EmpresaResponseDto[]> {
    return this.empresasService.listar();
  }

  @Public()
  @Get(':slug/publico')
  @ApiOperation({ summary: 'Nombre, logo y color de una tienda para mostrarla (sin token)' })
  publica(@Param('slug') slug: string): Promise<EmpresaPublicaResponseDto> {
    return this.empresasService.publica(slug);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una empresa' })
  obtener(@Param('id', ParseIntPipe) id: number): Promise<EmpresaResponseDto> {
    return this.empresasService.obtener(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crea una empresa lista para operar: roles, administrador, metodos de pago y catalogo base' })
  crear(@Body() dto: CrearEmpresaDto): Promise<EmpresaResponseDto> {
    return this.empresasService.crear(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edita nombre, datos fiscales y marca (el slug no cambia)' })
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarEmpresaDto): Promise<EmpresaResponseDto> {
    return this.empresasService.actualizar(id, dto);
  }

  @Patch(':id/estado')
  @ApiOperation({ summary: 'Suspende o reactiva una empresa (no borra datos)' })
  cambiarEstado(@Param('id', ParseIntPipe) id: number, @Body() dto: CambiarEstadoEmpresaDto): Promise<EmpresaResponseDto> {
    return this.empresasService.cambiarEstado(id, dto);
  }
}
