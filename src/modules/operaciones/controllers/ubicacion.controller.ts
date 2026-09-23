import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { UbicacionService } from '../services/ubicacion.service.js';
import { CrearCiudadDto } from '../dto/crear-ciudad.dto.js';
import type { CiudadResponseDto, DepartamentoResponseDto } from '../dto/sucursal-response.dto.js';

@ApiTags('Operaciones')
@Controller('operaciones')
export class UbicacionController {
  constructor(private readonly ubicacionService: UbicacionService) {}

  @Get('departamentos')
  @ApiOperation({ summary: 'Lista los departamentos (referencia para crear sucursales)' })
  listarDepartamentos(): Promise<DepartamentoResponseDto[]> {
    return this.ubicacionService.listarDepartamentos();
  }

  @Get('ciudades')
  @ApiOperation({ summary: 'Lista las ciudades con su departamento (referencia para crear sucursales)' })
  listarCiudades(): Promise<CiudadResponseDto[]> {
    return this.ubicacionService.listarCiudades();
  }

  @Post('ciudades')
  @RequirePermission('operaciones:sucursales:gestionar')
  @ApiOperation({ summary: 'Crea una ciudad dentro de un departamento existente' })
  crearCiudad(@Body() dto: CrearCiudadDto): Promise<CiudadResponseDto> {
    return this.ubicacionService.crearCiudad(dto);
  }
}
