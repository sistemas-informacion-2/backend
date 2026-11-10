import { MigrationInterface, QueryRunner } from "typeorm";
import { agregarEmpresaATabla, quitarUniqueDeColumna } from "../migraciones.util.js";

/**
 * SaaS, modulo comercial: ventas, compras, devoluciones, cajas, pagos y
 * metodos de pago pertenecen a una empresa (lo existente, a la 1). Codigo y
 * nro de factura de la nota de venta, codigo de devolucion y codigo de metodo
 * de pago pasan a ser unicos por empresa. Detalles y movimientos de caja
 * heredan la empresa de su cabecera.
 */
export class EmpresaEnComercial1794015836713 implements MigrationInterface {
    name = 'EmpresaEnComercial1794015836713'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await agregarEmpresaATabla(queryRunner, "caja", { obligatoria: true });
        await agregarEmpresaATabla(queryRunner, "nota_compra", { obligatoria: true });
        await agregarEmpresaATabla(queryRunner, "pasarela_de_pago", { obligatoria: true });
        await agregarEmpresaATabla(queryRunner, "pago", { obligatoria: true });
        await agregarEmpresaATabla(queryRunner, "nota_venta", { obligatoria: true });
        await agregarEmpresaATabla(queryRunner, "nota_devolucion", { obligatoria: true });
        await quitarUniqueDeColumna(queryRunner, "pasarela_de_pago", "codigo");
        await quitarUniqueDeColumna(queryRunner, "nota_venta", "codigo_nota");
        await quitarUniqueDeColumna(queryRunner, "nota_venta", "nro_factura");
        await quitarUniqueDeColumna(queryRunner, "nota_devolucion", "codigo_devolucion");
        await queryRunner.query(`CREATE INDEX "idx_caja_empresa" ON "caja"  ("id_empresa") `);
        await queryRunner.query(`CREATE INDEX "idx_nota_compra_empresa" ON "nota_compra"  ("id_empresa") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_pasarela_empresa_codigo" ON "pasarela_de_pago"  ("id_empresa", "codigo") `);
        await queryRunner.query(`CREATE INDEX "idx_pago_empresa" ON "pago"  ("id_empresa") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_nota_venta_empresa_factura" ON "nota_venta"  ("id_empresa", "nro_factura") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_nota_venta_empresa_codigo" ON "nota_venta"  ("id_empresa", "codigo_nota") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_nota_devolucion_empresa_codigo" ON "nota_devolucion"  ("id_empresa", "codigo_devolucion") `);
        await queryRunner.query(`ALTER TABLE "caja" ADD CONSTRAINT "FK_2d7c90fcfc47bc86ee3206af8b7" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "nota_compra" ADD CONSTRAINT "FK_559d1968a84e10b20a935878e32" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pasarela_de_pago" ADD CONSTRAINT "FK_0c72ab2bf0838b36bcbb9027d5d" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pago" ADD CONSTRAINT "FK_1ad393decc0b45ad06c743bf79a" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "nota_venta" ADD CONSTRAINT "FK_159800b2f0cbc4518d0d1b35acd" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "nota_devolucion" ADD CONSTRAINT "FK_a7c91c045b940066a2abcc60260" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "nota_devolucion" DROP CONSTRAINT "FK_a7c91c045b940066a2abcc60260"`);
        await queryRunner.query(`ALTER TABLE "nota_venta" DROP CONSTRAINT "FK_159800b2f0cbc4518d0d1b35acd"`);
        await queryRunner.query(`ALTER TABLE "pago" DROP CONSTRAINT "FK_1ad393decc0b45ad06c743bf79a"`);
        await queryRunner.query(`ALTER TABLE "pasarela_de_pago" DROP CONSTRAINT "FK_0c72ab2bf0838b36bcbb9027d5d"`);
        await queryRunner.query(`ALTER TABLE "nota_compra" DROP CONSTRAINT "FK_559d1968a84e10b20a935878e32"`);
        await queryRunner.query(`ALTER TABLE "caja" DROP CONSTRAINT "FK_2d7c90fcfc47bc86ee3206af8b7"`);
        await queryRunner.query(`DROP INDEX "public"."uq_nota_devolucion_empresa_codigo"`);
        await queryRunner.query(`DROP INDEX "public"."uq_nota_venta_empresa_codigo"`);
        await queryRunner.query(`DROP INDEX "public"."uq_nota_venta_empresa_factura"`);
        await queryRunner.query(`DROP INDEX "public"."idx_pago_empresa"`);
        await queryRunner.query(`DROP INDEX "public"."uq_pasarela_empresa_codigo"`);
        await queryRunner.query(`DROP INDEX "public"."idx_nota_compra_empresa"`);
        await queryRunner.query(`DROP INDEX "public"."idx_caja_empresa"`);
        await queryRunner.query(`ALTER TABLE "nota_devolucion" ADD CONSTRAINT "UQ_f77276e157bf327356d2ed690cb" UNIQUE ("codigo_devolucion")`);
        await queryRunner.query(`ALTER TABLE "nota_venta" ADD CONSTRAINT "UQ_a972789e43af78e9379a8500628" UNIQUE ("nro_factura")`);
        await queryRunner.query(`ALTER TABLE "nota_venta" ADD CONSTRAINT "UQ_e37850ff8ee43bd6419134c116a" UNIQUE ("codigo_nota")`);
        await queryRunner.query(`ALTER TABLE "pasarela_de_pago" ADD CONSTRAINT "UQ_b318f7c0c427922ac097f229ea6" UNIQUE ("codigo")`);
        await queryRunner.query(`ALTER TABLE "nota_devolucion" DROP COLUMN "id_empresa"`);
        await queryRunner.query(`ALTER TABLE "nota_venta" DROP COLUMN "id_empresa"`);
        await queryRunner.query(`ALTER TABLE "pago" DROP COLUMN "id_empresa"`);
        await queryRunner.query(`ALTER TABLE "pasarela_de_pago" DROP COLUMN "id_empresa"`);
        await queryRunner.query(`ALTER TABLE "nota_compra" DROP COLUMN "id_empresa"`);
        await queryRunner.query(`ALTER TABLE "caja" DROP COLUMN "id_empresa"`);
    }

}
