import { MigrationInterface, QueryRunner } from "typeorm";

export class ConversacionesBi1794183130258 implements MigrationInterface {
    name = 'ConversacionesBi1794183130258'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "bi_mensaje" ("id" SERIAL NOT NULL, "id_empresa" integer NOT NULL, "id_conversacion" integer NOT NULL, "rol" character varying(10) NOT NULL, "contenido" text NOT NULL, "herramientas" jsonb, "tokens_entrada" integer, "tokens_salida" integer, "fecha" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0be7b79482fe5dea8f1842748cc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_bi_mensaje_empresa_fecha" ON "bi_mensaje"  ("id_empresa", "fecha") `);
        await queryRunner.query(`CREATE INDEX "idx_bi_mensaje_conversacion" ON "bi_mensaje"  ("id_conversacion", "id") `);
        await queryRunner.query(`CREATE TABLE "bi_conversacion" ("id" SERIAL NOT NULL, "id_empresa" integer NOT NULL, "id_usuario" integer NOT NULL, "titulo" character varying(100) NOT NULL, "fecha_creacion" TIMESTAMP NOT NULL DEFAULT now(), "fecha_actualizacion" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d213c8f746c458e04bafa4da6e3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_bi_conversacion_usuario" ON "bi_conversacion"  ("id_empresa", "id_usuario", "fecha_actualizacion") `);
        await queryRunner.query(`ALTER TABLE "bi_mensaje" ADD CONSTRAINT "FK_7c60c57bd91fe201f804088f801" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bi_mensaje" ADD CONSTRAINT "FK_07654a7f16d7dc9042649acab03" FOREIGN KEY ("id_conversacion") REFERENCES "bi_conversacion"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bi_conversacion" ADD CONSTRAINT "FK_bd2a66fa7df70bd7ce4b9308f80" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bi_conversacion" ADD CONSTRAINT "FK_b18d8b03852bc32d7e2d411d1c9" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "bi_conversacion" DROP CONSTRAINT "FK_b18d8b03852bc32d7e2d411d1c9"`);
        await queryRunner.query(`ALTER TABLE "bi_conversacion" DROP CONSTRAINT "FK_bd2a66fa7df70bd7ce4b9308f80"`);
        await queryRunner.query(`ALTER TABLE "bi_mensaje" DROP CONSTRAINT "FK_07654a7f16d7dc9042649acab03"`);
        await queryRunner.query(`ALTER TABLE "bi_mensaje" DROP CONSTRAINT "FK_7c60c57bd91fe201f804088f801"`);
        await queryRunner.query(`DROP INDEX "public"."idx_bi_conversacion_usuario"`);
        await queryRunner.query(`DROP TABLE "bi_conversacion"`);
        await queryRunner.query(`DROP INDEX "public"."idx_bi_mensaje_conversacion"`);
        await queryRunner.query(`DROP INDEX "public"."idx_bi_mensaje_empresa_fecha"`);
        await queryRunner.query(`DROP TABLE "bi_mensaje"`);
    }

}
