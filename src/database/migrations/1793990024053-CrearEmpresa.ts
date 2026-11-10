import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Tabla empresa (SaaS) y la empresa 1: la tienda que ya existia. Las
 * migraciones siguientes asignan todos los datos actuales a esta empresa.
 */
export class CrearEmpresa1793990024053 implements MigrationInterface {
    name = 'CrearEmpresa1793990024053'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "empresa" ("id" SERIAL NOT NULL, "slug" character varying(60) NOT NULL, "nombre" character varying(120) NOT NULL, "razon_social" character varying(150), "nit" character varying(30), "logo_url" character varying(500), "color_primario" character varying(7), "estado" character varying(20) NOT NULL DEFAULT 'ACTIVA', "zona_horaria" character varying(60) NOT NULL DEFAULT 'America/La_Paz', "moneda" character varying(3) NOT NULL DEFAULT 'BOB', "fecha_creacion" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_f409aa5428a397fd07aa3dc877f" UNIQUE ("slug"), CONSTRAINT "PK_bee78e8f1760ccf9cff402118a6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`INSERT INTO "empresa" ("id", "slug", "nombre") VALUES (1, 'fashionstore', 'FashionStore')`);
        await queryRunner.query(`SELECT setval(pg_get_serial_sequence('empresa', 'id'), (SELECT MAX("id") FROM "empresa"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "empresa"`);
    }

}
