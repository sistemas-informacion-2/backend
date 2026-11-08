import { Module } from '@nestjs/common';
import { GeminiBiClient } from './agente/gemini.client.js';
import { BiEstadoController } from './controllers/bi-estado.controller.js';
import { EtlController } from './controllers/etl.controller.js';
import { AvisoMlService } from './etl/aviso-ml.service.js';
import { EtlProgramadoService } from './etl/etl-programado.service.js';
import { EtlService } from './etl/etl.service.js';
import { BiEstadoService } from './services/bi-estado.service.js';

/**
 * Inteligencia de negocio: Data Warehouse (esquema dw), ETL, agente con Gemini, herramientas y dashboards.
 * Convive con el modulo `reporte` (CU18). Ver PLAN-BI.md en la raiz del proyecto.
 */
@Module({
  controllers: [BiEstadoController, EtlController],
  providers: [GeminiBiClient, BiEstadoService, EtlService, EtlProgramadoService, AvisoMlService],
  exports: [EtlService],
})
export class BiModule {}
