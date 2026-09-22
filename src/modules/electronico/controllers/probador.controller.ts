import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator.js';
import type { ProbadorVarianteDto } from '../dto/probador.dto.js';
import { ProbadorService } from '../services/probador.service.js';

/**
 * Probador virtual (CU19). Es de consulta publica: el cliente lo abre desde el
 * catalogo para probarse la prenda antes de llevarla al carrito (CU14).
 */
@ApiTags('Electronico')
@Controller('electronico/probador')
export class ProbadorController {
  constructor(private readonly probadorService: ProbadorService) {}

  @Public()
  @Get('variante/:id')
  @ApiOperation({ summary: 'Assets publicos de una variante para el probador virtual (CU19)' })
  variante(@Param('id', ParseIntPipe) id: number): Promise<ProbadorVarianteDto> {
    return this.probadorService.variante(id);
  }
}