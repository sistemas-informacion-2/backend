import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AvisoMlService } from './aviso-ml.service.js';
import { CARGAS_ETL } from './cargas/index.js';

export type OrigenEtl = 'PROGRAMADO' | 'MANUAL';

export interface ResumenEtl {
  idEjecucion: number;
  idEmpresa: number;
  origen: OrigenEtl;
  segundos: number;
  /** Filas de la empresa en cada tabla del DW despues de la carga. */
  filas: Record<string, number>;
}

export interface EjecucionEtl {
  id: number;
  origen: OrigenEtl;
  estado: 'EN_CURSO' | 'OK' | 'ERROR';
  inicio: Date;
  fin: Date | null;
  filas: Record<string, number> | null;
  error: string | null;
  idUsuario: number | null;
}

/** Clave del bloqueo de Postgres (junto con el id de la empresa) que impide dos cargas a la vez de la misma empresa. */
const CLAVE_BLOQUEO = 7301;
const LIMITE_HISTORIAL = 20;

/**
 * ETL del Data Warehouse (fase 2 de PLAN-BI.md): copia los datos de una empresa del esquema public al esquema dw con
 * SQL, en una sola transaccion. Las dimensiones se insertan o actualizan; los hechos de la empresa se borran y se
 * vuelven a cargar enteros, asi el DW queda siempre igual al origen. Cada carga queda en dw.etl_ejecucion (la fila
 * se escribe por otra conexion: sobrevive aunque la carga se deshaga).
 */
@Injectable()
export class EtlService {
  private readonly logger = new Logger(EtlService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly avisoMl: AvisoMlService,
  ) {}

  async ejecutar(idEmpresa: number, origen: OrigenEtl, idUsuario: number | null = null): Promise<ResumenEtl> {
    const inicio = Date.now();
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    let idEjecucion: number | null = null;
    const filas: Record<string, number> = {};
    try {
      await queryRunner.startTransaction();
      const [{ libre }] = (await queryRunner.query(`SELECT pg_try_advisory_xact_lock($1, $2) AS libre`, [CLAVE_BLOQUEO, idEmpresa])) as Array<{ libre: boolean }>;
      if (!libre) throw new ConflictException('Ya hay una carga de datos en curso para esta empresa; espera a que termine');

      idEjecucion = await this.registrarInicio(idEmpresa, origen, idUsuario);
      for (const carga of CARGAS_ETL) {
        if (carga.tipo === 'HECHO') await queryRunner.query(`DELETE FROM dw.${carga.tabla} WHERE id_empresa = $1`, [idEmpresa]);
        await queryRunner.query(carga.sql, [idEmpresa]);
        const [{ n }] = (await queryRunner.query(`SELECT count(*)::int AS n FROM dw.${carga.tabla} WHERE id_empresa = $1`, [idEmpresa])) as Array<{ n: number }>;
        filas[carga.tabla] = n;
      }
      await queryRunner.commitTransaction();
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      if (idEjecucion !== null) await this.registrarFin(idEjecucion, 'ERROR', null, error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      await queryRunner.release();
    }

    await this.registrarFin(idEjecucion as number, 'OK', filas, null);
    const segundos = Math.round((Date.now() - inicio) / 100) / 10;
    this.logger.log(`DW de la empresa ${idEmpresa} cargado (${origen}) en ${segundos} s: ${filas.fact_ventas ?? 0} lineas de venta`);
    await this.avisoMl.cargaTerminada(idEmpresa);
    return { idEjecucion: idEjecucion as number, idEmpresa, origen, segundos, filas };
  }

  async historial(idEmpresa: number): Promise<EjecucionEtl[]> {
    return this.dataSource.query<EjecucionEtl[]>(
      `SELECT id, origen, estado, inicio, fin, filas, error, id_usuario AS "idUsuario"
         FROM dw.etl_ejecucion WHERE id_empresa = $1 ORDER BY inicio DESC, id DESC LIMIT ${LIMITE_HISTORIAL}`,
      [idEmpresa],
    );
  }

  private async registrarInicio(idEmpresa: number, origen: OrigenEtl, idUsuario: number | null): Promise<number> {
    const [{ id }] = await this.dataSource.query<Array<{ id: number }>>(
      `INSERT INTO dw.etl_ejecucion (id_empresa, origen, estado, id_usuario) VALUES ($1, $2, 'EN_CURSO', $3) RETURNING id`,
      [idEmpresa, origen, idUsuario],
    );
    return id;
  }

  private async registrarFin(id: number, estado: 'OK' | 'ERROR', filas: Record<string, number> | null, error: string | null): Promise<void> {
    await this.dataSource.query(`UPDATE dw.etl_ejecucion SET estado = $2, fin = now(), filas = $3, error = $4 WHERE id = $1`, [
      id,
      estado,
      filas === null ? null : JSON.stringify(filas),
      error === null ? null : error.slice(0, 2000),
    ]);
  }
}
