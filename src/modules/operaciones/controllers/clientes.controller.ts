import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { ClientesService } from '../services/clientes.service.js';
import { CrearClienteDto } from '../dto/crear-cliente.dto.js';
import { ActualizarClienteDto } from '../dto/actualizar-cliente.dto.js';
import { ClientesQueryDto } from '../dto/clientes-query.dto.js';
import type { ClienteResponseDto, ClientesPaginatedResponseDto } from '../dto/cliente-response.dto.js';

@ApiTags('Clientes')
@Controller('operaciones/clientes')
@RequirePermission('acceso:clientes:gestionar')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista clientes con filtros y paginacion' })
  listar(@Query() query: ClientesQueryDto): Promise<ClientesPaginatedResponseDto> {
    return this.clientesService.listar(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene un cliente por ID de usuario' })
  obtener(@Param('id', ParseIntPipe) id: number): Promise<ClienteResponseDto> {
    return this.clientesService.obtenerPorId(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crea un cliente con su cuenta de acceso' })
  crear(@Body() dto: CrearClienteDto): Promise<ClienteResponseDto> {
    return this.clientesService.crear(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualiza los datos de un cliente' })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarClienteDto,
  ): Promise<ClienteResponseDto> {
    return this.clientesService.actualizar(id, dto);
  }
}
