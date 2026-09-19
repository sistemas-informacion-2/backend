import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { EmpleadosService } from '../services/empleados.service.js';
import { CrearEmpleadoDto } from '../dto/crear-empleado.dto.js';
import { ActualizarEmpleadoDto } from '../dto/actualizar-empleado.dto.js';
import { EmpleadosQueryDto } from '../dto/empleados-query.dto.js';
import type { EmpleadoResponseDto, EmpleadosPaginatedResponseDto } from '../dto/empleado-response.dto.js';

@ApiTags('Empleados')
@Controller('operaciones/empleados')
@RequirePermission('operaciones:empleados:gestionar')
export class EmpleadosController {
  constructor(private readonly empleadosService: EmpleadosService) {}

  @Get()
  @ApiOperation({ summary: 'Lista empleados con filtros y paginacion' })
  listar(@Query() query: EmpleadosQueryDto): Promise<EmpleadosPaginatedResponseDto> {
    return this.empleadosService.listar(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene un empleado por ID de usuario' })
  obtener(@Param('id', ParseIntPipe) id: number): Promise<EmpleadoResponseDto> {
    return this.empleadosService.obtenerPorId(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crea un empleado con su cuenta de acceso' })
  crear(@Body() dto: CrearEmpleadoDto): Promise<EmpleadoResponseDto> {
    return this.empleadosService.crear(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualiza los datos de un empleado' })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarEmpleadoDto,
  ): Promise<EmpleadoResponseDto> {
    return this.empleadosService.actualizar(id, dto);
  }
}
