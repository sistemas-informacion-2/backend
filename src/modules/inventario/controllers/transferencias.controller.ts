import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { RequireAnyPermission } from '../../../common/decorators/require-any-permission.decorator.js';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';
import { TransferenciasService } from '../services/transferencias.service.js';
import { TransferirStockDto, type TransferenciaResponseDto } from '../dto/transferencia.dto.js';

@ApiTags('Inventario')
@Controller('inventario/transferencias')
@RequirePermission('inventario:almacen:gestionar')
export class TransferenciasController {
  constructor(private readonly transferenciasService: TransferenciasService) {}

  @Get()
  @RequireAnyPermission('inventario:almacen:gestionar', 'inventario:almacen:leer')
  @ApiOperation({ summary: 'Ultimas transferencias de stock entre almacenes' })
  listar(): Promise<TransferenciaResponseDto[]> {
    return this.transferenciasService.listar();
  }

  @Get(':id')
  @RequireAnyPermission('inventario:almacen:gestionar', 'inventario:almacen:leer')
  @ApiOperation({ summary: 'Detalle de una transferencia' })
  obtener(@Param('id', ParseIntPipe) id: number): Promise<TransferenciaResponseDto> {
    return this.transferenciasService.obtener(id);
  }

  @Post()
  @ApiOperation({ summary: 'Mueve unidades de una variante de un almacen a otro (queda en el kardex)' })
  transferir(@Body() dto: TransferirStockDto, @CurrentUser() usuario: ActiveUser): Promise<TransferenciaResponseDto> {
    return this.transferenciasService.transferir(dto, usuario);
  }
}
