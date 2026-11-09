import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgenteService } from './agente/agente.service.js';
import { GeminiBiClient } from './agente/gemini.client.js';
import { AgenteController } from './controllers/agente.controller.js';
import { BiEstadoController } from './controllers/bi-estado.controller.js';
import { EtlController } from './controllers/etl.controller.js';
import { BiConversacion } from './entities/bi-conversacion.entity.js';
import { BiMensaje } from './entities/bi-mensaje.entity.js';
import { AvisoMlService } from './etl/aviso-ml.service.js';
import { EtlProgramadoService } from './etl/etl-programado.service.js';
import { EtlService } from './etl/etl.service.js';
import { MlClienteService } from './herramientas/ml-cliente.service.js';
import { RegistroHerramientas } from './herramientas/registro-herramientas.service.js';
import { BiEstadoService } from './services/bi-estado.service.js';

/**
 * Inteligencia de negocio: Data Warehouse (esquema dw), ETL, agente con Gemini, herramientas y dashboards.
 * Convive con el modulo `reporte` (CU18). Ver PLAN-BI.md en la raiz del proyecto.
 */
@Module({
  imports: [TypeOrmModule.forFeature([BiConversacion, BiMensaje])],
  controllers: [BiEstadoController, EtlController, AgenteController],
  providers: [GeminiBiClient, BiEstadoService, EtlService, EtlProgramadoService, AvisoMlService, MlClienteService, RegistroHerramientas, AgenteService],
  exports: [EtlService],
})
export class BiModule {}
