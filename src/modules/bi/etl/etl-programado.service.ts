import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { DataSource } from 'typeorm';
import type { AppConfig } from '../../../config/configuration.js';
import { ZONA_HORARIA } from '../../../common/utils/fecha.util.js';
import { DIAS_GRACIA } from '../../../common/tenant/plan-vigencia.js';
import { EtlService } from './etl.service.js';

const NOMBRE_TAREA = 'bi-etl-nocturno';

/**
 * Carga nocturna del DW (BI_ETL_CRON, por defecto 02:00 hora de La Paz) de todas las empresas activas, una por una.
 * Si una falla, queda en su bitacora y siguen las demas. BI_ETL_PROGRAMADO=false la apaga (queda solo a pedido).
 */
@Injectable()
export class EtlProgramadoService implements OnModuleInit {
  private readonly logger = new Logger(EtlProgramadoService.name);
  private readonly bi: AppConfig['bi'];

  constructor(
    private readonly etl: EtlService,
    private readonly dataSource: DataSource,
    private readonly scheduler: SchedulerRegistry,
    config: ConfigService<AppConfig, true>,
  ) {
    this.bi = config.get('bi', { infer: true });
  }

  onModuleInit(): void {
    if (!this.bi.etlProgramado) {
      this.logger.log('Carga nocturna del DW desactivada (BI_ETL_PROGRAMADO=false)');
      return;
    }
    try {
      const tarea = CronJob.from({ cronTime: this.bi.etlCron, onTick: () => void this.cargarTodas(), start: true, timeZone: ZONA_HORARIA });
      this.scheduler.addCronJob(NOMBRE_TAREA, tarea);
    } catch (error) {
      this.logger.error(`BI_ETL_CRON invalido ("${this.bi.etlCron}"): la carga nocturna no se programo. ${error instanceof Error ? error.message : ''}`);
    }
  }

  /**
   * Carga el DW de cada empresa activa cuyo plan incluye el BI (y no vencio hace mas de la gracia); devuelve
   * cuantas terminaron bien. Las demas no lo usan: cargarlo seria trabajo de mas cada noche.
   */
  async cargarTodas(): Promise<number> {
    const empresas = await this.dataSource.query<Array<{ id: number; slug: string }>>(
      `SELECT e.id, e.slug
         FROM empresa e
         JOIN plan p ON p.id = e.id_plan
        WHERE e.estado = 'ACTIVA' AND p.bi
          AND (e.plan_vence_el IS NULL OR e.plan_vence_el > now() - interval '${DIAS_GRACIA} days')
        ORDER BY e.id`,
    );
    let correctas = 0;
    for (const empresa of empresas) {
      try {
        await this.etl.ejecutar(empresa.id, 'PROGRAMADO');
        correctas++;
      } catch (error) {
        this.logger.error(`Fallo la carga del DW de ${empresa.slug}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return correctas;
  }
}
