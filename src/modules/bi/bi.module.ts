import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgenteService } from './agente/agente.service.js';
import { GeminiBiClient } from './agente/gemini.client.js';
import { AgenteController } from './controllers/agente.controller.js';
import { BiEstadoController } from './controllers/bi-estado.controller.js';
import { EtlController } from './controllers/etl.controller.js';
import { GraficosController } from './controllers/graficos.controller.js';
import { ModelosController } from './controllers/modelos.controller.js';
import { BiConversacion } from './entities/bi-conversacion.entity.js';
import { BiGrafico } from './entities/bi-grafico.entity.js';
import { BiMensaje } from './entities/bi-mensaje.entity.js';
import { AvisoMlService } from './etl/aviso-ml.service.js';
import { EtlProgramadoService } from './etl/etl-programado.service.js';
import { EtlService } from './etl/etl.service.js';
import { MlClienteService } from './herramientas/ml-cliente.service.js';
import { RegistroHerramientas } from './herramientas/registro-herramientas.service.js';
import { BiEstadoService } from './services/bi-estado.service.js';
import { GraficosService } from './services/graficos.service.js';
import { ModelosService } from './services/modelos.service.js';

/**
 * Inteligencia de negocio: Data Warehouse (esquema dw), ETL, agente con Gemini, herramientas y dashboards.
 * Convive con el modulo `reporte` (CU18). Ver PLAN-BI.md en la raiz del proyecto.
 */
@Module({
  imports: [TypeOrmModule.forFeature([BiConversacion, BiMensaje, BiGrafico])],
  controllers: [BiEstadoController, EtlController, AgenteController, ModelosController, GraficosController],
  providers: [GeminiBiClient, BiEstadoService, EtlService, EtlProgramadoService, AvisoMlService, MlClienteService, RegistroHerramientas, AgenteService, ModelosService, GraficosService],
  exports: [EtlService],
})
export class BiModule {}
