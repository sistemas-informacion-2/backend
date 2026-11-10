import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 3 del BI: tablas donde el servicio de machine learning (ml/, Python) deja sus resultados por empresa. El agente
 * y los dashboards las leen como cualquier tabla del DW; si el servicio se cae, se sigue viendo lo ultimo calculado.
 *
 * Rol `bi_entrenador` (sin login): hereda la lectura de `bi_lector` y solo puede escribir en dw.ml_*. El usuario con
 * el que se conecta el servicio pertenece a este rol (docs/BI-DW.md).
 */
export class ResultadosMl1794176600035 implements MigrationInterface {
  name = 'ResultadosMl1794176600035';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "dw"."ml_ejecucion" (
        "id" serial PRIMARY KEY,
        "id_empresa" integer NOT NULL,
        "estado" varchar(12) NOT NULL CHECK ("estado" IN ('EN_CURSO', 'OK', 'PARCIAL', 'ERROR')),
        "inicio" timestamp NOT NULL DEFAULT now(),
        "fin" timestamp,
        "metricas" jsonb,
        "error" text
      )`);
    await queryRunner.query(`CREATE INDEX "idx_ml_ejecucion_empresa_inicio" ON "dw"."ml_ejecucion" ("id_empresa", "inicio" DESC)`);
    await queryRunner.query(`
      CREATE TABLE "dw"."ml_pronostico" (
        "id_empresa" integer NOT NULL,
        "ambito" varchar(10) NOT NULL CHECK ("ambito" IN ('TOTAL', 'SUCURSAL', 'CATEGORIA')),
        "clave" text NOT NULL,
        "frecuencia" varchar(8) NOT NULL CHECK ("frecuencia" IN ('MENSUAL', 'SEMANAL')),
        "periodo" date NOT NULL,
        "valor" numeric(14,2) NOT NULL,
        "bajo" numeric(14,2) NOT NULL,
        "alto" numeric(14,2) NOT NULL,
        "modelo" text NOT NULL,
        PRIMARY KEY ("id_empresa", "ambito", "clave", "frecuencia", "periodo")
      )`);
    await queryRunner.query(`
      CREATE TABLE "dw"."ml_sugerencia_compra" (
        "id_empresa" integer NOT NULL,
        "id_variante" integer NOT NULL,
        "id_sucursal" integer NOT NULL,
        "demanda_esperada" numeric(12,2) NOT NULL,
        "stock_actual" integer NOT NULL,
        "stock_seguridad" numeric(12,2) NOT NULL,
        "cantidad_sugerida" integer NOT NULL,
        "motivo" text NOT NULL,
        PRIMARY KEY ("id_empresa", "id_variante", "id_sucursal")
      )`);
    await queryRunner.query(`
      CREATE TABLE "dw"."ml_riesgo_abandono" (
        "id_empresa" integer NOT NULL,
        "id_cliente" integer NOT NULL,
        "probabilidad" numeric(5,4) NOT NULL,
        "nivel" varchar(5) NOT NULL CHECK ("nivel" IN ('ALTO', 'MEDIO', 'BAJO')),
        "factores" jsonb NOT NULL,
        PRIMARY KEY ("id_empresa", "id_cliente")
      )`);
    await queryRunner.query(`
      CREATE TABLE "dw"."ml_segmento_cliente" (
        "id_empresa" integer NOT NULL,
        "id_cliente" integer NOT NULL,
        "segmento" text NOT NULL,
        "grupo" integer NOT NULL,
        "recencia_dias" integer NOT NULL,
        "frecuencia" integer NOT NULL,
        "monto" numeric(14,2) NOT NULL,
        PRIMARY KEY ("id_empresa", "id_cliente")
      )`);
    await queryRunner.query(`
      CREATE TABLE "dw"."ml_asociacion" (
        "id_empresa" integer NOT NULL,
        "id_producto_a" integer NOT NULL,
        "producto_a" text NOT NULL,
        "id_producto_b" integer NOT NULL,
        "producto_b" text NOT NULL,
        "soporte" numeric(6,4) NOT NULL,
        "confianza" numeric(6,4) NOT NULL,
        "lift" numeric(10,4) NOT NULL,
        "notas" integer NOT NULL,
        PRIMARY KEY ("id_empresa", "id_producto_a", "id_producto_b")
      )`);
    await queryRunner.query(`
      CREATE TABLE "dw"."ml_anomalia" (
        "id_empresa" integer NOT NULL,
        "fecha" date NOT NULL,
        "id_sucursal" integer NOT NULL,
        "metrica" varchar(20) NOT NULL,
        "valor_real" numeric(14,2) NOT NULL,
        "valor_esperado" numeric(14,2) NOT NULL,
        "desviacion" numeric(10,2) NOT NULL,
        "gravedad" varchar(5) NOT NULL CHECK ("gravedad" IN ('ALTA', 'MEDIA')),
        PRIMARY KEY ("id_empresa", "fecha", "id_sucursal", "metrica")
      )`);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bi_entrenador') THEN
          CREATE ROLE bi_entrenador NOLOGIN;
        END IF;
        GRANT bi_lector TO bi_entrenador;
        GRANT SELECT ON ALL TABLES IN SCHEMA dw TO bi_lector;
        GRANT INSERT, UPDATE, DELETE ON
          dw.ml_ejecucion, dw.ml_pronostico, dw.ml_sugerencia_compra, dw.ml_riesgo_abandono, dw.ml_segmento_cliente, dw.ml_asociacion, dw.ml_anomalia
          TO bi_entrenador;
        GRANT USAGE ON SEQUENCE dw.ml_ejecucion_id_seq TO bi_entrenador;
      EXCEPTION WHEN insufficient_privilege OR undefined_object THEN
        RAISE NOTICE 'No se pudo configurar el rol bi_entrenador; ver docs/BI-DW.md';
      END
      $$`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const tabla of ['ml_anomalia', 'ml_asociacion', 'ml_segmento_cliente', 'ml_riesgo_abandono', 'ml_sugerencia_compra', 'ml_pronostico', 'ml_ejecucion']) {
      await queryRunner.query(`DROP TABLE IF EXISTS "dw"."${tabla}"`);
    }
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bi_entrenador') THEN
          DROP ROLE bi_entrenador;
        END IF;
      EXCEPTION WHEN insufficient_privilege OR dependent_objects_still_exist THEN
        RAISE NOTICE 'El rol bi_entrenador no se pudo borrar';
      END
      $$`);
  }
}
