import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { BitacoraService } from '../services/bitacora.service.js';
import { BitacoraQueryDto } from '../dto/bitacora-query.dto.js';
import type { BitacoraPaginatedResponseDto, BitacoraResponseDto } from '../dto/bitacora-response.dto.js';

@ApiTags('Bitácora')
@Controller('acceso/bitacora')
@RequirePermission('acceso:bitacora:leer')
export class BitacoraController {
  constructor(private readonly bitacoraService: BitacoraService) {}

  @Get()
  @ApiOperation({ summary: 'Consulta registros de auditoría con filtros y paginación' })
  listar(@Query() query: BitacoraQueryDto): Promise<BitacoraPaginatedResponseDto> {
    return this.bitacoraService.listar(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene el detalle de un registro de auditoría' })
  obtener(@Param('id') id: string): Promise<BitacoraResponseDto> {
    return this.bitacoraService.obtenerPorId(id);
  }
}