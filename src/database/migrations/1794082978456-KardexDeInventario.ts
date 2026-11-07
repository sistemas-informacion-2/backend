import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * R5 del BI: kardex (movimiento_inventario). Cada cambio de stock queda registrado en la misma transaccion que lo
 * produce; el stock existente entra como SALDO_INICIAL.
 */
export class KardexDeInventario1794082978456 implements MigrationInterface {
    name = 'KardexDeInventario1794082978456'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "movimiento_inventario" ("id" SERIAL NOT NULL, "id_empresa" integer NOT NULL, "id_almacen" integer NOT NULL, "id_variante_producto" integer NOT NULL, "tipo" character varying(30) NOT NULL, "cantidad" integer NOT NULL, "delta_reservado" integer NOT NULL DEFAULT '0', "stock_resultante" integer NOT NULL, "reservado_resultante" integer NOT NULL DEFAULT '0', "costo_unitario" numeric(12,4), "referencia_tipo" character varying(20), "referencia_id" integer, "id_usuario" integer, "motivo" character varying(255), "fecha_hora" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_46b3c1c6a31b3b0ee001df7888e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_movimiento_inventario_referencia" ON "movimiento_inventario"  ("referencia_tipo", "referencia_id") `);
        await queryRunner.query(`CREATE INDEX "idx_movimiento_inventario_stock" ON "movimiento_inventario"  ("id_almacen", "id_variante_producto", "fecha_hora") `);
        await queryRunner.query(`CREATE INDEX "idx_movimiento_inventario_empresa_fecha" ON "movimiento_inventario"  ("id_empresa", "fecha_hora") `);
        await queryRunner.query(`ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "FK_419fa93de47add02c950d49facf" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "FK_d8fa4d32a9345688a8bed5161d0" FOREIGN KEY ("id_almacen") REFERENCES "almacen"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "FK_ba6fbdd7a0c27ea612a6c9e95a1" FOREIGN KEY ("id_variante_producto") REFERENCES "variante_producto"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        // El stock que ya existia entra como saldo inicial: asi la suma del kardex de cada fila es su stock actual.
        await queryRunner.query(`
            INSERT INTO "movimiento_inventario"
                   ("id_empresa", "id_almacen", "id_variante_producto", "tipo", "cantidad", "delta_reservado",
                    "stock_resultante", "reservado_resultante", "costo_unitario", "motivo")
            SELECT a."id_empresa", i."id_almacen", i."id_variante_producto", 'SALDO_INICIAL', i."stock_disponible", i."stock_reservado",
                   i."stock_disponible", i."stock_reservado", v."costo_promedio", 'Stock existente al crear el kardex'
              FROM "inventario" i
              JOIN "almacen" a ON a."id" = i."id_almacen"
              JOIN "variante_producto" v ON v."id" = i."id_variante_producto"
             WHERE i."stock_disponible" <> 0 OR i."stock_reservado" <> 0`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "movimiento_inventario" DROP CONSTRAINT "FK_ba6fbdd7a0c27ea612a6c9e95a1"`);
        await queryRunner.query(`ALTER TABLE "movimiento_inventario" DROP CONSTRAINT "FK_d8fa4d32a9345688a8bed5161d0"`);
        await queryRunner.query(`ALTER TABLE "movimiento_inventario" DROP CONSTRAINT "FK_419fa93de47add02c950d49facf"`);
        await queryRunner.query(`DROP INDEX "public"."idx_movimiento_inventario_empresa_fecha"`);
        await queryRunner.query(`DROP INDEX "public"."idx_movimiento_inventario_stock"`);
        await queryRunner.query(`DROP INDEX "public"."idx_movimiento_inventario_referencia"`);
        await queryRunner.query(`DROP TABLE "movimiento_inventario"`);
    }

}
