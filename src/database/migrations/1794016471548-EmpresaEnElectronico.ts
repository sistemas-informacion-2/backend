import { MigrationInterface, QueryRunner } from "typeorm";
import { agregarEmpresaATabla, quitarUniqueDeColumna } from "../migraciones.util.js";

/**
 * SaaS, modulo electronico: carritos, reservas y notificaciones pertenecen a
 * una empresa (lo existente, a la 1); el codigo de reserva pasa a ser unico por
 * empresa. Detalles de carrito y reserva heredan la empresa de su cabecera; el
 * token de un dispositivo push sigue siendo unico global (es del celular).
 */
export class EmpresaEnElectronico1794016471548 implements MigrationInterface {
    name = 'EmpresaEnElectronico1794016471548'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await agregarEmpresaATabla(queryRunner, "carrito", { obligatoria: true });
        await agregarEmpresaATabla(queryRunner, "reserva", { obligatoria: true });
        await agregarEmpresaATabla(queryRunner, "notificacion_push", { obligatoria: true });
        await quitarUniqueDeColumna(queryRunner, "reserva", "codigo_reserva");
        await queryRunner.query(`CREATE INDEX "idx_carrito_empresa" ON "carrito"  ("id_empresa") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_reserva_empresa_codigo" ON "reserva"  ("id_empresa", "codigo_reserva") `);
        await queryRunner.query(`CREATE INDEX "idx_notificacion_push_empresa" ON "notificacion_push"  ("id_empresa") `);
        await queryRunner.query(`ALTER TABLE "carrito" ADD CONSTRAINT "FK_c80dfa57973b0a67a3f6a96f46e" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reserva" ADD CONSTRAINT "FK_02261db5b27929eeaf6f408dbb4" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notificacion_push" ADD CONSTRAINT "FK_3fb1578b7891f01be54dadc0449" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notificacion_push" DROP CONSTRAINT "FK_3fb1578b7891f01be54dadc0449"`);
        await queryRunner.query(`ALTER TABLE "reserva" DROP CONSTRAINT "FK_02261db5b27929eeaf6f408dbb4"`);
        await queryRunner.query(`ALTER TABLE "carrito" DROP CONSTRAINT "FK_c80dfa57973b0a67a3f6a96f46e"`);
        await queryRunner.query(`DROP INDEX "public"."idx_notificacion_push_empresa"`);
        await queryRunner.query(`DROP INDEX "public"."uq_reserva_empresa_codigo"`);
        await queryRunner.query(`DROP INDEX "public"."idx_carrito_empresa"`);
        await queryRunner.query(`ALTER TABLE "reserva" ADD CONSTRAINT "UQ_65fa737b6e5db6e6feed1a901fe" UNIQUE ("codigo_reserva")`);
        await queryRunner.query(`ALTER TABLE "notificacion_push" DROP COLUMN "id_empresa"`);
        await queryRunner.query(`ALTER TABLE "reserva" DROP COLUMN "id_empresa"`);
        await queryRunner.query(`ALTER TABLE "carrito" DROP COLUMN "id_empresa"`);
    }

}
