import { MigrationInterface, QueryRunner } from "typeorm";

export class GraficosBi1794192365937 implements MigrationInterface {
    name = 'GraficosBi1794192365937'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "bi_grafico" ("id" SERIAL NOT NULL, "id_empresa" integer NOT NULL, "id_usuario" integer NOT NULL, "titulo" character varying(100) NOT NULL, "herramienta" character varying(60) NOT NULL, "parametros" jsonb NOT NULL, "fecha_creacion" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4010aeb48017adb8f2785da2123" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_bi_grafico_usuario" ON "bi_grafico"  ("id_empresa", "id_usuario", "fecha_creacion") `);
        await queryRunner.query(`ALTER TABLE "bi_grafico" ADD CONSTRAINT "FK_eae7991a02ad8953bce84471b9f" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bi_grafico" ADD CONSTRAINT "FK_a7ca2844d1ca7143ba007aecda0" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "bi_grafico" DROP CONSTRAINT "FK_a7ca2844d1ca7143ba007aecda0"`);
        await queryRunner.query(`ALTER TABLE "bi_grafico" DROP CONSTRAINT "FK_eae7991a02ad8953bce84471b9f"`);
        await queryRunner.query(`DROP INDEX "public"."idx_bi_grafico_usuario"`);
        await queryRunner.query(`DROP TABLE "bi_grafico"`);
    }

}
