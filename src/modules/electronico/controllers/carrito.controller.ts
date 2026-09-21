import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import { CarritoService } from '../services/carrito.service.js';
import { ActualizarItemCarritoDto, AgregarItemCarritoDto, type CarritoResponseDto } from '../dto/carrito.dto.js';

/**
 * Carrito del cliente autenticado (CU14). Sin permiso asignable: el servicio exige que el usuario
 * sea cliente y siempre opera sobre su propio carrito (id tomado del JWT, nunca del cuerpo).
 */
@ApiTags('Electronico')
@Controller('electronico/carrito')
export class CarritoController {
  constructor(private readonly carritoService: CarritoService) {}

  @Get()
  @ApiOperation({ summary: 'Obtiene el carrito del cliente con foto, talla, color, stock y subtotales' })
  obtener(@CurrentUser() usuario: ActiveUser): Promise<CarritoResponseDto> {
    return this.carritoService.obtener(usuario);
  }

  @Post('items')
  @ApiOperation({ summary: 'Agrega una variante; si ya estaba, suma la cantidad' })
  agregar(@Body() dto: AgregarItemCarritoDto, @CurrentUser() usuario: ActiveUser): Promise<CarritoResponseDto> {
    return this.carritoService.agregarItem(usuario, dto);
  }

  @Patch('items/:id')
  @ApiOperation({ summary: 'Fija la cantidad de un item del carrito' })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarItemCarritoDto,
    @CurrentUser() usuario: ActiveUser,
  ): Promise<CarritoResponseDto> {
    return this.carritoService.actualizarCantidad(usuario, id, dto);
  }

  @Delete('items/:id')
  @ApiOperation({ summary: 'Quita un item del carrito' })
  quitar(@Param('id', ParseIntPipe) id: number, @CurrentUser() usuario: ActiveUser): Promise<CarritoResponseDto> {
    return this.carritoService.quitarItem(usuario, id);
  }

  @Delete()
  @ApiOperation({ summary: 'Vacia el carrito' })
  vaciar(@CurrentUser() usuario: ActiveUser): Promise<CarritoResponseDto> {
    return this.carritoService.vaciar(usuario);
  }
}
