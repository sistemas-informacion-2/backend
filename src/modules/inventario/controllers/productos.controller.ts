import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator.js';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { ProductosService } from '../services/productos.service.js';
import { CrearProductoDto } from '../dto/crear-producto.dto.js';
import { ActualizarProductoDto } from '../dto/actualizar-producto.dto.js';
import { CrearVarianteProductoDto } from '../dto/crear-variante-producto.dto.js';
import { ActualizarVarianteProductoDto } from '../dto/actualizar-variante-producto.dto.js';
import { CrearImagenProductoDto } from '../dto/crear-imagen-producto.dto.js';
import { ActualizarImagenProductoDto } from '../dto/actualizar-imagen-producto.dto.js';
import { ProductosQueryDto } from '../dto/productos-query.dto.js';
import { ProductosPublicoQueryDto } from '../dto/productos-publico-query.dto.js';
import type { ProductoResponseDto, ProductosPaginatedResponseDto } from '../dto/producto-response.dto.js';

@ApiTags('Inventario')
@Controller('inventario/productos')
export class ProductosController {
  constructor(private readonly productosService: ProductosService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Catálogo público de productos activos' })
  listarPublico(@Query() query: ProductosPublicoQueryDto): Promise<ProductoResponseDto[]> {
    return this.productosService.listarPublico(query);
  }

  @Get('todas')
  @RequirePermission('inventario:productos:gestionar')
  @ApiOperation({ summary: 'Lista productos paginada con filtros (uso administrativo)' })
  listar(@Query() query: ProductosQueryDto): Promise<ProductosPaginatedResponseDto> {
    return this.productosService.listar(query);
  }

  @Get(':id')
  @RequirePermission('inventario:productos:gestionar')
  @ApiOperation({ summary: 'Obtiene un producto con su galería y variantes' })
  obtener(@Param('id', ParseIntPipe) id: number): Promise<ProductoResponseDto> {
    return this.productosService.obtener(id);
  }

  @Post()
  @RequirePermission('inventario:productos:gestionar')
  @ApiOperation({ summary: 'Crea un producto con su galería de imágenes y variantes' })
  crear(@Body() dto: CrearProductoDto): Promise<ProductoResponseDto> {
    return this.productosService.crear(dto);
  }

  @Put(':id')
  @RequirePermission('inventario:productos:gestionar')
  @ApiOperation({ summary: 'Actualiza la cabecera del producto o lo desactiva' })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarProductoDto,
  ): Promise<ProductoResponseDto> {
    return this.productosService.actualizar(id, dto);
  }

  @Delete(':id')
  @RequirePermission('inventario:productos:gestionar')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desactiva lógicamente un producto' })
  async eliminar(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.productosService.eliminar(id);
  }

  @Post(':id/variantes')
  @RequirePermission('inventario:productos:gestionar')
  @ApiOperation({ summary: 'Agrega una variante (SKU, talla, color, corte) al producto' })
  agregarVariante(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CrearVarianteProductoDto,
  ): Promise<ProductoResponseDto> {
    return this.productosService.agregarVariante(id, dto);
  }

  @Put(':id/variantes/:varianteId')
  @RequirePermission('inventario:productos:gestionar')
  @ApiOperation({ summary: 'Actualiza o desactiva una variante existente' })
  actualizarVariante(
    @Param('id', ParseIntPipe) id: number,
    @Param('varianteId', ParseIntPipe) varianteId: number,
    @Body() dto: ActualizarVarianteProductoDto,
  ): Promise<ProductoResponseDto> {
    return this.productosService.actualizarVariante(id, varianteId, dto);
  }

  @Delete(':id/variantes/:varianteId')
  @RequirePermission('inventario:productos:gestionar')
  @ApiOperation({ summary: 'Desactiva una variante' })
  eliminarVariante(
    @Param('id', ParseIntPipe) id: number,
    @Param('varianteId', ParseIntPipe) varianteId: number,
  ): Promise<ProductoResponseDto> {
    return this.productosService.eliminarVariante(id, varianteId);
  }

  @Post(':id/imagenes')
  @RequirePermission('inventario:productos:gestionar')
  @ApiOperation({ summary: 'Agrega una imagen a la galería del producto' })
  agregarImagen(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CrearImagenProductoDto,
  ): Promise<ProductoResponseDto> {
    return this.productosService.agregarImagen(id, dto);
  }

  @Put(':id/imagenes/:imagenId')
  @RequirePermission('inventario:productos:gestionar')
  @ApiOperation({ summary: 'Actualiza una imagen (url, orden o imagen principal)' })
  actualizarImagen(
    @Param('id', ParseIntPipe) id: number,
    @Param('imagenId', ParseIntPipe) imagenId: number,
    @Body() dto: ActualizarImagenProductoDto,
  ): Promise<ProductoResponseDto> {
    return this.productosService.actualizarImagen(id, imagenId, dto);
  }

  @Delete(':id/imagenes/:imagenId')
  @RequirePermission('inventario:productos:gestionar')
  @ApiOperation({ summary: 'Elimina una imagen de la galería' })
  eliminarImagen(
    @Param('id', ParseIntPipe) id: number,
    @Param('imagenId', ParseIntPipe) imagenId: number,
  ): Promise<ProductoResponseDto> {
    return this.productosService.eliminarImagen(id, imagenId);
  }
}
