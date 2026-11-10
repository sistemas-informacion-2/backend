import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Cobros de los planes de DOMINATR (alta pagada, renovacion y cambio de plan). En un alta, la fila guarda los
 * datos del registro hasta que Stripe confirma el pago; ahi se crea la empresa y se llena id_empresa.
 */
export class PagosDePlan1794281000000 implements MigrationInterface {
    name = 'PagosDePlan1794281000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "pago_plan" ("id" SERIAL NOT NULL, "id_empresa" integer, "id_plan" integer NOT NULL, "tipo" character varying(20) NOT NULL, "estado" character varying(20) NOT NULL DEFAULT 'PENDIENTE', "monto" numeric(10,2) NOT NULL, "stripe_session_id" character varying(255), "stripe_payment_intent_id" character varying(255), "datos_registro" jsonb, "id_usuario" integer, "periodo_desde" TIMESTAMP, "periodo_hasta" TIMESTAMP, "detalle_error" character varying(255), "fecha_creacion" TIMESTAMP NOT NULL DEFAULT now(), "fecha_pago" TIMESTAMP, CONSTRAINT "UQ_pago_plan_stripe_session" UNIQUE ("stripe_session_id"), CONSTRAINT "PK_pago_plan" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_pago_plan_empresa" ON "pago_plan" ("id_empresa", "fecha_creacion") `);
        await queryRunner.query(`ALTER TABLE "pago_plan" ADD CONSTRAINT "FK_892a772f01831cc3afe2543e37a" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pago_plan" ADD CONSTRAINT "FK_b08810dbcad385441865f63955b" FOREIGN KEY ("id_plan") REFERENCES "plan"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pago_plan" DROP CONSTRAINT "FK_b08810dbcad385441865f63955b"`);
        await queryRunner.query(`ALTER TABLE "pago_plan" DROP CONSTRAINT "FK_892a772f01831cc3afe2543e37a"`);
        await queryRunner.query(`DROP INDEX "public"."idx_pago_plan_empresa"`);
        await queryRunner.query(`DROP TABLE "pago_plan"`);
    }

}
