import type { MigrationInterface, QueryRunner } from 'typeorm';
import { generarCalendario } from '../dw/calendario.js';

const CALENDARIO_DESDE = '2020-01-01';
const CALENDARIO_HASTA = '2032-12-31';
const LOTE = 500;

/**
 * Fase 1 del BI: el Data Warehouse en el esquema `dw` de la misma base, en estrella (ver docs/BI-DW.md).
 *
 * - Las claves de las dimensiones son los id de origen (ya unicos en toda la base), asi el ETL recarga los hechos de
 *   una empresa sin traducir claves. Todas las tablas, salvo dim_fecha, llevan id_empresa.
 * - Los hechos traen ya repartidas las medidas de cabecera (descuento e impuesto de la nota) y el margen calculado:
 *   las herramientas del agente solo suman.
 * - El ETL (fase 2) llena todo salvo dim_fecha, que se llena aqui.
 * - Rol `bi_lector` (sin login): solo lectura del esquema `dw`. Si el usuario de la base no puede crear roles
 *   (por ejemplo en un Postgres administrado), se omite con un aviso: ver docs/BI-DW.md.
 */
export class DataWarehouse1794169589484 implements MigrationInterface {
  name = 'DataWarehouse1794169589484';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "dw"`);

    // ---------------------------------------------------------------- dimensiones
    await queryRunner.query(`
      CREATE TABLE "dw"."dim_fecha" (
        "fecha_key" integer PRIMARY KEY,
        "fecha" date NOT NULL UNIQUE,
        "anio" smallint NOT NULL,
        "trimestre" smallint NOT NULL,
        "mes" smallint NOT NULL,
        "nombre_mes" varchar(12) NOT NULL,
        "semana_iso" smallint NOT NULL,
        "anio_iso" smallint NOT NULL,
        "dia" smallint NOT NULL,
        "dia_semana" smallint NOT NULL,
        "nombre_dia" varchar(10) NOT NULL,
        "es_fin_de_semana" boolean NOT NULL,
        "es_feriado" boolean NOT NULL,
        "nombre_feriado" varchar(60),
        "temporada" varchar(10) NOT NULL
      )`);
    await queryRunner.query(`
      CREATE TABLE "dw"."dim_sucursal" (
        "id_sucursal" integer PRIMARY KEY,
        "id_empresa" integer NOT NULL,
        "nombre" text NOT NULL,
        "ciudad" text,
        "departamento" text,
        "activo" boolean NOT NULL,
        "actualizado_en" timestamp NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`
      CREATE TABLE "dw"."dim_almacen" (
        "id_almacen" integer PRIMARY KEY,
        "id_empresa" integer NOT NULL,
        "id_sucursal" integer NOT NULL REFERENCES "dw"."dim_sucursal",
        "nombre" text NOT NULL,
        "activo" boolean NOT NULL,
        "actualizado_en" timestamp NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`
      CREATE TABLE "dw"."dim_producto" (
        "id_variante" integer PRIMARY KEY,
        "id_empresa" integer NOT NULL,
        "sku" text NOT NULL,
        "talla" text,
        "color" text,
        "corte" text,
        "id_producto" integer NOT NULL,
        "producto" text NOT NULL,
        "id_categoria" integer,
        "categoria" text,
        "categoria_padre" text,
        "precio_actual" numeric(12,2) NOT NULL,
        "descuento_actual" numeric(5,2) NOT NULL DEFAULT 0,
        "costo_promedio_actual" numeric(12,4),
        "activo" boolean NOT NULL,
        "actualizado_en" timestamp NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`
      CREATE TABLE "dw"."dim_cliente" (
        "id_cliente" integer PRIMARY KEY,
        "id_empresa" integer NOT NULL,
        "nombre" text NOT NULL,
        "sexo" char(1),
        "ciudad" text,
        "fecha_alta" date,
        "es_consumidor_final" boolean NOT NULL DEFAULT false,
        "actualizado_en" timestamp NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`
      CREATE TABLE "dw"."dim_proveedor" (
        "id_proveedor" integer PRIMARY KEY,
        "id_empresa" integer NOT NULL,
        "nombre" text NOT NULL,
        "nit" text,
        "activo" boolean NOT NULL,
        "actualizado_en" timestamp NOT NULL DEFAULT now()
      )`);
    for (const dimension of ['dim_sucursal', 'dim_almacen', 'dim_producto', 'dim_cliente', 'dim_proveedor']) {
      await queryRunner.query(`CREATE INDEX "idx_${dimension}_empresa" ON "dw"."${dimension}" ("id_empresa")`);
    }

    // ---------------------------------------------------------------- hechos
    await queryRunner.query(`
      CREATE TABLE "dw"."fact_ventas" (
        "id_detalle_venta" integer PRIMARY KEY,
        "id_empresa" integer NOT NULL,
        "id_nota" integer NOT NULL,
        "codigo_nota" text NOT NULL,
        "fecha_key" integer NOT NULL REFERENCES "dw"."dim_fecha",
        "hora" time NOT NULL,
        "id_sucursal" integer NOT NULL REFERENCES "dw"."dim_sucursal",
        "id_cliente" integer NOT NULL REFERENCES "dw"."dim_cliente",
        "id_variante" integer REFERENCES "dw"."dim_producto",
        "id_cajero" integer,
        "canal" varchar(10) NOT NULL CHECK ("canal" IN ('MOSTRADOR', 'ONLINE', 'RESERVA')),
        "metodo_pago" text,
        "cantidad" integer NOT NULL,
        "precio_lista" numeric(12,2) NOT NULL,
        "precio_unitario" numeric(12,2) NOT NULL,
        "descuento_producto" numeric(14,2) NOT NULL,
        "importe_bruto" numeric(14,2) NOT NULL,
        "descuento_nota" numeric(14,4) NOT NULL,
        "impuesto_nota" numeric(14,4) NOT NULL,
        "importe_neto" numeric(14,4) NOT NULL,
        "costo_unitario" numeric(12,4),
        "costo_total" numeric(14,4),
        "margen" numeric(14,4)
      )`);
    await queryRunner.query(`
      CREATE TABLE "dw"."fact_devoluciones" (
        "id_detalle_devolucion" integer PRIMARY KEY,
        "id_empresa" integer NOT NULL,
        "id_devolucion" integer NOT NULL,
        "codigo_devolucion" text NOT NULL,
        "fecha_key" integer NOT NULL REFERENCES "dw"."dim_fecha",
        "fecha_venta_key" integer REFERENCES "dw"."dim_fecha",
        "id_detalle_venta" integer,
        "id_sucursal" integer NOT NULL REFERENCES "dw"."dim_sucursal",
        "id_cliente" integer NOT NULL REFERENCES "dw"."dim_cliente",
        "id_variante" integer NOT NULL REFERENCES "dw"."dim_producto",
        "motivo" text NOT NULL,
        "estado_producto" text NOT NULL,
        "cantidad" integer NOT NULL,
        "monto_reembolsado" numeric(14,2) NOT NULL,
        "costo_unitario" numeric(12,4),
        "costo_recuperado" numeric(14,4),
        "costo_perdido" numeric(14,4)
      )`);
    await queryRunner.query(`
      CREATE TABLE "dw"."fact_compras" (
        "id_detalle_compra" integer PRIMARY KEY,
        "id_empresa" integer NOT NULL,
        "id_compra" integer NOT NULL,
        "nro_factura" text,
        "fecha_key" integer NOT NULL REFERENCES "dw"."dim_fecha",
        "id_sucursal" integer NOT NULL REFERENCES "dw"."dim_sucursal",
        "id_almacen" integer NOT NULL REFERENCES "dw"."dim_almacen",
        "id_proveedor" integer NOT NULL REFERENCES "dw"."dim_proveedor",
        "id_variante" integer NOT NULL REFERENCES "dw"."dim_producto",
        "estado" text NOT NULL,
        "cantidad" integer NOT NULL,
        "costo_unitario" numeric(12,2) NOT NULL,
        "importe" numeric(14,2) NOT NULL
      )`);
    await queryRunner.query(`
      CREATE TABLE "dw"."fact_inventario_diario" (
        "id_empresa" integer NOT NULL,
        "fecha_key" integer NOT NULL REFERENCES "dw"."dim_fecha",
        "id_almacen" integer NOT NULL REFERENCES "dw"."dim_almacen",
        "id_variante" integer NOT NULL REFERENCES "dw"."dim_producto",
        "stock_disponible" integer NOT NULL,
        "stock_reservado" integer NOT NULL,
        "entradas" integer NOT NULL DEFAULT 0,
        "salidas" integer NOT NULL DEFAULT 0,
        "valor_costo" numeric(14,2),
        PRIMARY KEY ("id_empresa", "fecha_key", "id_almacen", "id_variante")
      )`);
    await queryRunner.query(`
      CREATE TABLE "dw"."fact_movimientos_inventario" (
        "id_movimiento" integer PRIMARY KEY,
        "id_empresa" integer NOT NULL,
        "fecha_key" integer NOT NULL REFERENCES "dw"."dim_fecha",
        "hora" time NOT NULL,
        "id_almacen" integer NOT NULL REFERENCES "dw"."dim_almacen",
        "id_variante" integer NOT NULL REFERENCES "dw"."dim_producto",
        "tipo" text NOT NULL,
        "cantidad" integer NOT NULL,
        "delta_reservado" integer NOT NULL,
        "costo_unitario" numeric(12,4),
        "valor" numeric(14,4),
        "referencia_tipo" text,
        "referencia_id" integer,
        "es_transferencia" boolean NOT NULL
      )`);
    await queryRunner.query(`
      CREATE TABLE "dw"."fact_pagos" (
        "id_pago" integer PRIMARY KEY,
        "id_empresa" integer NOT NULL,
        "fecha_key" integer NOT NULL REFERENCES "dw"."dim_fecha",
        "hora" time NOT NULL,
        "id_sucursal" integer REFERENCES "dw"."dim_sucursal",
        "concepto" text NOT NULL,
        "metodo" text,
        "canal" varchar(10) NOT NULL CHECK ("canal" IN ('PRESENCIAL', 'ONLINE')),
        "monto" numeric(14,2) NOT NULL,
        "monto_neto" numeric(14,2) NOT NULL,
        "id_nota_venta" integer,
        "id_reserva" integer
      )`);
    await queryRunner.query(`
      CREATE TABLE "dw"."fact_gastos" (
        "id_movimiento_caja" integer PRIMARY KEY,
        "id_empresa" integer NOT NULL,
        "fecha_key" integer NOT NULL REFERENCES "dw"."dim_fecha",
        "hora" time NOT NULL,
        "id_sucursal" integer NOT NULL REFERENCES "dw"."dim_sucursal",
        "categoria" text NOT NULL,
        "subcategoria" text,
        "concepto" text NOT NULL,
        "monto" numeric(14,2) NOT NULL
      )`);
    await queryRunner.query(`
      CREATE TABLE "dw"."fact_reservas" (
        "id_reserva" integer PRIMARY KEY,
        "id_empresa" integer NOT NULL,
        "codigo_reserva" text NOT NULL,
        "fecha_key" integer NOT NULL REFERENCES "dw"."dim_fecha",
        "fecha_desenlace_key" integer REFERENCES "dw"."dim_fecha",
        "id_sucursal" integer NOT NULL REFERENCES "dw"."dim_sucursal",
        "id_cliente" integer NOT NULL REFERENCES "dw"."dim_cliente",
        "estado" text NOT NULL,
        "monto_total" numeric(14,2) NOT NULL,
        "monto_anticipo" numeric(14,2) NOT NULL,
        "anticipo_pagado" numeric(14,2) NOT NULL,
        "horas_hasta_desenlace" numeric(8,2),
        "id_nota_venta" integer
      )`);
    const hechos = ['fact_ventas', 'fact_devoluciones', 'fact_compras', 'fact_movimientos_inventario', 'fact_pagos', 'fact_gastos', 'fact_reservas'];
    for (const hecho of hechos) {
      await queryRunner.query(`CREATE INDEX "idx_${hecho}_empresa_fecha" ON "dw"."${hecho}" ("id_empresa", "fecha_key")`);
    }
    await queryRunner.query(`CREATE INDEX "idx_fact_ventas_empresa_variante" ON "dw"."fact_ventas" ("id_empresa", "id_variante")`);
    await queryRunner.query(`CREATE INDEX "idx_fact_ventas_empresa_cliente" ON "dw"."fact_ventas" ("id_empresa", "id_cliente")`);
    await queryRunner.query(`CREATE INDEX "idx_fact_inventario_diario_variante" ON "dw"."fact_inventario_diario" ("id_empresa", "id_variante", "fecha_key")`);

    // ---------------------------------------------------------------- control del ETL
    await queryRunner.query(`
      CREATE TABLE "dw"."etl_ejecucion" (
        "id" serial PRIMARY KEY,
        "id_empresa" integer NOT NULL,
        "origen" varchar(12) NOT NULL CHECK ("origen" IN ('PROGRAMADO', 'MANUAL')),
        "estado" varchar(12) NOT NULL CHECK ("estado" IN ('EN_CURSO', 'OK', 'ERROR')),
        "inicio" timestamp NOT NULL DEFAULT now(),
        "fin" timestamp,
        "filas" jsonb,
        "error" text,
        "id_usuario" integer
      )`);
    await queryRunner.query(`CREATE INDEX "idx_etl_ejecucion_empresa_inicio" ON "dw"."etl_ejecucion" ("id_empresa", "inicio" DESC)`);

    // ---------------------------------------------------------------- calendario
    const dias = generarCalendario(CALENDARIO_DESDE, CALENDARIO_HASTA);
    for (let i = 0; i < dias.length; i += LOTE) {
      const lote = dias.slice(i, i + LOTE);
      const valores: unknown[] = [];
      const filas = lote.map((d, j) => {
        valores.push(d.fechaKey, d.fecha, d.anio, d.trimestre, d.mes, d.nombreMes, d.semanaIso, d.anioIso, d.dia, d.diaSemana, d.nombreDia, d.esFinDeSemana, d.feriado !== null, d.feriado, d.temporada);
        return `(${Array.from({ length: 15 }, (_, k) => `$${j * 15 + k + 1}`).join(', ')})`;
      });
      await queryRunner.query(
        `INSERT INTO "dw"."dim_fecha" ("fecha_key", "fecha", "anio", "trimestre", "mes", "nombre_mes", "semana_iso", "anio_iso", "dia", "dia_semana", "nombre_dia", "es_fin_de_semana", "es_feriado", "nombre_feriado", "temporada") VALUES ${filas.join(', ')}`,
        valores,
      );
    }

    // ---------------------------------------------------------------- rol de solo lectura
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bi_lector') THEN
          CREATE ROLE bi_lector NOLOGIN;
        END IF;
        GRANT USAGE ON SCHEMA dw TO bi_lector;
        GRANT SELECT ON ALL TABLES IN SCHEMA dw TO bi_lector;
        ALTER DEFAULT PRIVILEGES IN SCHEMA dw GRANT SELECT ON TABLES TO bi_lector;
      EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'Sin permiso para crear o configurar el rol bi_lector; ver docs/BI-DW.md';
      END
      $$`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP SCHEMA IF EXISTS "dw" CASCADE`);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bi_lector') THEN
          DROP ROLE bi_lector;
        END IF;
      EXCEPTION WHEN insufficient_privilege OR dependent_objects_still_exist THEN
        RAISE NOTICE 'El rol bi_lector no se pudo borrar; quedo sin permisos sobre dw';
      END
      $$`);
  }
}
