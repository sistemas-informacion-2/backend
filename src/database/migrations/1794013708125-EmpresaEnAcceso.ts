import { MigrationInterface, QueryRunner } from "typeorm";
import { agregarEmpresaATabla, quitarUniqueDeColumna } from "../migraciones.util.js";

/**
 * SaaS, modulo acceso: usuario, rol y bitacora pasan a pertenecer a una
 * empresa. Todo lo existente queda en la empresa 1 (fashionstore). El email
 * pasa a ser unico por empresa y el nombre de rol tambien.
 */
export class EmpresaEnAcceso1794013708125 implements MigrationInterface {
    name = 'EmpresaEnAcceso1794013708125'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await agregarEmpresaATabla(queryRunner, "rol", { obligatoria: true });
        // Nullable: el superadmin de la plataforma no pertenece a ninguna empresa.
        await agregarEmpresaATabla(queryRunner, "usuario", { obligatoria: false });
        // Nullable: las acciones de la plataforma no ocurren dentro de una empresa.
        await agregarEmpresaATabla(queryRunner, "bitacora", { obligatoria: false });
        await quitarUniqueDeColumna(queryRunner, "rol", "nombre");
        await quitarUniqueDeColumna(queryRunner, "usuario", "email");
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_rol_empresa_nombre" ON "rol"  ("id_empresa", "nombre") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_usuario_plataforma_email" ON "usuario"  ("email") WHERE "id_empresa" IS NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_usuario_empresa_email" ON "usuario"  ("id_empresa", "email") `);
        await queryRunner.query(`CREATE INDEX "idx_bitacora_empresa_fecha" ON "bitacora"  ("id_empresa", "fecha_hora") `);
        await queryRunner.query(`ALTER TABLE "rol" ADD CONSTRAINT "FK_fc198d502fa3dab2020b0264c28" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "usuario" ADD CONSTRAINT "FK_bc230c0bc8f5e58876473362cf5" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bitacora" ADD CONSTRAINT "FK_0f83e58634c3cbbbae2a50246b2" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "bitacora" DROP CONSTRAINT "FK_0f83e58634c3cbbbae2a50246b2"`);
        await queryRunner.query(`ALTER TABLE "usuario" DROP CONSTRAINT "FK_bc230c0bc8f5e58876473362cf5"`);
        await queryRunner.query(`ALTER TABLE "rol" DROP CONSTRAINT "FK_fc198d502fa3dab2020b0264c28"`);
        await queryRunner.query(`DROP INDEX "public"."idx_bitacora_empresa_fecha"`);
        await queryRunner.query(`DROP INDEX "public"."uq_usuario_empresa_email"`);
        await queryRunner.query(`DROP INDEX "public"."uq_usuario_plataforma_email"`);
        await queryRunner.query(`DROP INDEX "public"."uq_rol_empresa_nombre"`);
        await queryRunner.query(`ALTER TABLE "usuario" ADD CONSTRAINT "UQ_2863682842e688ca198eb25c124" UNIQUE ("email")`);
        await queryRunner.query(`ALTER TABLE "rol" ADD CONSTRAINT "UQ_9792c580a992d554ee1621c5b45" UNIQUE ("nombre")`);
        await queryRunner.query(`ALTER TABLE "bitacora" DROP COLUMN "id_empresa"`);
        await queryRunner.query(`ALTER TABLE "usuario" DROP COLUMN "id_empresa"`);
        await queryRunner.query(`ALTER TABLE "rol" DROP COLUMN "id_empresa"`);
    }

}
