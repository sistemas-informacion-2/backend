import { MigrationInterface, QueryRunner } from "typeorm";
import { agregarEmpresaATabla } from "../migraciones.util.js";

/**
 * SaaS, modulo operaciones: cada sucursal pertenece a una empresa (las
 * existentes, a la empresa 1). Cliente y empleado no necesitan columna: su PK
 * es el usuario, que ya tiene empresa desde EmpresaEnAcceso.
 */
export class EmpresaEnOperaciones1794014288643 implements MigrationInterface {
    name = 'EmpresaEnOperaciones1794014288643'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await agregarEmpresaATabla(queryRunner, "sucursal", { obligatoria: true });
        await queryRunner.query(`CREATE INDEX "idx_sucursal_empresa" ON "sucursal"  ("id_empresa") `);
        await queryRunner.query(`ALTER TABLE "sucursal" ADD CONSTRAINT "FK_1b14785b9e6716d1d9c4b06c728" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sucursal" DROP CONSTRAINT "FK_1b14785b9e6716d1d9c4b06c728"`);
        await queryRunner.query(`DROP INDEX "public"."idx_sucursal_empresa"`);
        await queryRunner.query(`ALTER TABLE "sucursal" DROP COLUMN "id_empresa"`);
    }

}
