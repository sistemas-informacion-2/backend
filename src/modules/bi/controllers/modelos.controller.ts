import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { ModelosQueryDto, type PronosticoModeloDto, type ResumenModelosDto } from '../dto/modelos.dto.js';
import type { ResultadoHerramienta } from '../herramientas/herramienta.js';
import { ModelosService } from '../services/modelos.service.js';

@ApiTags('BI')
@Controller('bi/modelos')
@RequirePermission('analitica:bi:usar')
export class ModelosController {
  constructor(private readonly modelos: ModelosService) {}

  @Get()
  @ApiOperation({ summary: 'Resumen de los modelos: tipo, tecnica y metricas de la ultima corrida' })
  resumen(): Promise<ResumenModelosDto> {
    return this.modelos.resumen();
  }

  @Get('pronostico')
  @ApiOperation({ summary: 'Ventas pasadas y pronosticadas, para un mismo grafico' })
  pronostico(@Query() q: ModelosQueryDto): Promise<PronosticoModeloDto> {
    return this.modelos.pronostico({ frecuencia: q.frecuencia, sucursal: q.sucursal, categoria: q.categoria });
  }

  @Get('clientes-en-riesgo')
  @ApiOperation({ summary: 'Clientes con mas probabilidad de abandono' })
  clientesEnRiesgo(@Query() q: ModelosQueryDto): Promise<ResultadoHerramienta> {
    return this.modelos.consultar('clientes_en_riesgo', { nivel: q.nivel, limite: q.limite ?? 100 });
  }

  @Get('segmentos')
  @ApiOperation({ summary: 'Segmentos de clientes' })
  segmentos(): Promise<ResultadoHerramienta> {
    return this.modelos.consultar('segmentos_de_clientes', {});
  }

  @Get('canasta')
  @ApiOperation({ summary: 'Productos que se compran juntos' })
  canasta(@Query() q: ModelosQueryDto): Promise<ResultadoHerramienta> {
    return this.modelos.consultar('productos_que_se_compran_juntos', { producto: q.producto, limite: q.limite ?? 100 });
  }

  @Get('anomalias')
  @ApiOperation({ summary: 'Dias atipicos por sucursal' })
  anomalias(@Query() q: ModelosQueryDto): Promise<ResultadoHerramienta> {
    return this.modelos.consultar('anomalias_recientes', { desde: q.desde, hasta: q.hasta, sucursal: q.sucursal, limite: q.limite ?? 100 });
  }

  @Get('sugerencia-compra')
  @ApiOperation({ summary: 'Que reponer y cuanto' })
  sugerenciaCompra(@Query() q: ModelosQueryDto): Promise<ResultadoHerramienta> {
    return this.modelos.consultar('sugerencia_de_compra', { sucursal: q.sucursal, categoria: q.categoria, limite: q.limite ?? 100 });
  }
}
