import { Body, Controller, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator.js';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { CategoriasService } from '../services/categorias.service.js';
import { CrearCategoriaDto } from '../dto/crear-categoria.dto.js';
import { ActualizarCategoriaDto } from '../dto/actualizar-categoria.dto.js';
import type { CategoriaResponseDto } from '../dto/categoria-response.dto.js';

@ApiTags('Inventario')
@Controller('inventario/categorias')
export class CategoriasController {
  constructor(private readonly categoriasService: CategoriasService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Árbol de categorías activas (alimenta el catálogo público)' })
  listarPublico(): Promise<CategoriaResponseDto[]> {
    return this.categoriasService.listarPublico();
  }

  @Get('todas')
  @RequirePermission('inventario:categorias:gestionar')
  @ApiOperation({ summary: 'Árbol de categorías, incluidas las inactivas (uso administrativo)' })
  listarTodas(): Promise<CategoriaResponseDto[]> {
    return this.categoriasService.listarTodas();
  }

  @Post()
  @RequirePermission('inventario:categorias:gestionar')
  @ApiOperation({ summary: 'Crea una categoría' })
  crear(@Body() dto: CrearCategoriaDto): Promise<CategoriaResponseDto> {
    return this.categoriasService.crear(dto);
  }

  @Put(':id')
  @RequirePermission('inventario:categorias:gestionar')
  @ApiOperation({ summary: 'Actualiza o desactiva una categoría' })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarCategoriaDto,
  ): Promise<CategoriaResponseDto> {
    return this.categoriasService.actualizar(id, dto);
  }
}
