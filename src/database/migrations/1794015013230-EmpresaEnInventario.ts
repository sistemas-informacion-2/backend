import { MigrationInterface, QueryRunner } from "typeorm";
import { agregarEmpresaATabla, quitarUniqueDeColumna } from "../migraciones.util.js";

/**
 * SaaS, modulo inventario: productos, variantes, categorias, temporadas,
 * proveedores y almacenes pertenecen a una empresa (lo existente, a la 1).
 * El slug de categoria, el NIT de proveedor y el SKU pasan a ser unicos por
 * empresa. inventario, imagen_producto, producto_sucursal y
 * temporada_categoria heredan la empresa de su tabla padre.
 */
export class EmpresaEnInventario1794015013230 implements MigrationInterface {
    name = 'EmpresaEnInventario1794015013230'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await agregarEmpresaATabla(queryRunner, "temporada", { obligatoria: true });
        await agregarEmpresaATabla(queryRunner, "categoria", { obligatoria: true });
        await agregarEmpresaATabla(queryRunner, "producto", { obligatoria: true });
        await agregarEmpresaATabla(queryRunner, "variante_producto", { obligatoria: true });
        await agregarEmpresaATabla(queryRunner, "almacen", { obligatoria: true });
        await agregarEmpresaATabla(queryRunner, "proveedor", { obligatoria: true });
        await quitarUniqueDeColumna(queryRunner, "categoria", "slug");
        await quitarUniqueDeColumna(queryRunner, "variante_producto", "sku");
        await quitarUniqueDeColumna(queryRunner, "proveedor", "nit");
        await queryRunner.query(`CREATE INDEX "idx_temporada_empresa" ON "temporada"  ("id_empresa") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_categoria_empresa_slug" ON "categoria"  ("id_empresa", "slug") `);
        await queryRunner.query(`CREATE INDEX "idx_producto_empresa" ON "producto"  ("id_empresa") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_variante_empresa_sku" ON "variante_producto"  ("id_empresa", "sku") `);
        await queryRunner.query(`CREATE INDEX "idx_almacen_empresa" ON "almacen"  ("id_empresa") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_proveedor_empresa_nit" ON "proveedor"  ("id_empresa", "nit") `);
        await queryRunner.query(`ALTER TABLE "temporada" ADD CONSTRAINT "FK_e17e9af70be8debcad11ec220b4" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "categoria" ADD CONSTRAINT "FK_71ed302a8caeb6c3534ed1827ee" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "producto" ADD CONSTRAINT "FK_b4e44f63332d77ad773dfd046fa" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "variante_producto" ADD CONSTRAINT "FK_12f8e69e1b98dd895476cd9199d" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "almacen" ADD CONSTRAINT "FK_78de21c80349203f530d947b2c3" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "proveedor" ADD CONSTRAINT "FK_156febe065c79de75ce0dad20de" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "proveedor" DROP CONSTRAINT "FK_156febe065c79de75ce0dad20de"`);
        await queryRunner.query(`ALTER TABLE "almacen" DROP CONSTRAINT "FK_78de21c80349203f530d947b2c3"`);
        await queryRunner.query(`ALTER TABLE "variante_producto" DROP CONSTRAINT "FK_12f8e69e1b98dd895476cd9199d"`);
        await queryRunner.query(`ALTER TABLE "producto" DROP CONSTRAINT "FK_b4e44f63332d77ad773dfd046fa"`);
        await queryRunner.query(`ALTER TABLE "categoria" DROP CONSTRAINT "FK_71ed302a8caeb6c3534ed1827ee"`);
        await queryRunner.query(`ALTER TABLE "temporada" DROP CONSTRAINT "FK_e17e9af70be8debcad11ec220b4"`);
        await queryRunner.query(`DROP INDEX "public"."uq_proveedor_empresa_nit"`);
        await queryRunner.query(`DROP INDEX "public"."idx_almacen_empresa"`);
        await queryRunner.query(`DROP INDEX "public"."uq_variante_empresa_sku"`);
        await queryRunner.query(`DROP INDEX "public"."idx_producto_empresa"`);
        await queryRunner.query(`DROP INDEX "public"."uq_categoria_empresa_slug"`);
        await queryRunner.query(`DROP INDEX "public"."idx_temporada_empresa"`);
        await queryRunner.query(`ALTER TABLE "proveedor" ADD CONSTRAINT "UQ_91cccc7fa6bcdca0d32c16bba38" UNIQUE ("nit")`);
        await queryRunner.query(`ALTER TABLE "variante_producto" ADD CONSTRAINT "UQ_0f2bc20b6276004a4716c00bdd4" UNIQUE ("sku")`);
        await queryRunner.query(`ALTER TABLE "categoria" ADD CONSTRAINT "UQ_cbbfb0456c7eeb9755a7e94e807" UNIQUE ("slug")`);
        await queryRunner.query(`ALTER TABLE "proveedor" DROP COLUMN "id_empresa"`);
        await queryRunner.query(`ALTER TABLE "almacen" DROP COLUMN "id_empresa"`);
        await queryRunner.query(`ALTER TABLE "variante_producto" DROP COLUMN "id_empresa"`);
        await queryRunner.query(`ALTER TABLE "producto" DROP COLUMN "id_empresa"`);
        await queryRunner.query(`ALTER TABLE "categoria" DROP COLUMN "id_empresa"`);
        await queryRunner.query(`ALTER TABLE "temporada" DROP COLUMN "id_empresa"`);
    }

}
