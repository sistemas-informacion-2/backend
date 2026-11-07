import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Requisitos del BI (R3 y R4): cada linea vendida guarda precio de lista, descuento por unidad y costo, y cada
 * variante su costo promedio ponderado.
 *
 * Datos existentes:
 * - precio_lista = precio cobrado y descuento 0: no se guardo que descuento tenia el producto al vender.
 * - costo_promedio = promedio ponderado de todas las compras registradas de la variante (null si nunca se compro).
 * - costo_unitario de las ventas viejas queda null (costo desconocido): el BI las trata como sin margen.
 */
export class PrecioYCostoPorLinea1794081959889 implements MigrationInterface {
    name = 'PrecioYCostoPorLinea1794081959889'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "variante_producto" ADD "costo_promedio" numeric(12,4)`);
        await queryRunner.query(`ALTER TABLE "detalle_reserva" ADD "precio_lista" numeric(12,2)`);
        await queryRunner.query(`UPDATE "detalle_reserva" SET "precio_lista" = "precio_unitario"`);
        await queryRunner.query(`ALTER TABLE "detalle_reserva" ALTER COLUMN "precio_lista" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "detalle_reserva" ADD "descuento_unitario" numeric(12,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "detalle_nota_venta" ADD "precio_lista" numeric(12,2)`);
        await queryRunner.query(`UPDATE "detalle_nota_venta" SET "precio_lista" = "precio_unitario"`);
        await queryRunner.query(`ALTER TABLE "detalle_nota_venta" ALTER COLUMN "precio_lista" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "detalle_nota_venta" ADD "descuento_unitario" numeric(12,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "detalle_nota_venta" ADD "costo_unitario" numeric(12,4)`);
        await queryRunner.query(`
            UPDATE "variante_producto" v
               SET "costo_promedio" = c.costo
              FROM (SELECT "id_variante_producto", ROUND(SUM("cantidad" * "precio_unitario") / NULLIF(SUM("cantidad"), 0), 4) AS costo
                      FROM "detalle_nota_compra"
                     GROUP BY "id_variante_producto") c
             WHERE c."id_variante_producto" = v."id"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "detalle_nota_venta" DROP COLUMN "costo_unitario"`);
        await queryRunner.query(`ALTER TABLE "detalle_nota_venta" DROP COLUMN "descuento_unitario"`);
        await queryRunner.query(`ALTER TABLE "detalle_nota_venta" DROP COLUMN "precio_lista"`);
        await queryRunner.query(`ALTER TABLE "detalle_reserva" DROP COLUMN "descuento_unitario"`);
        await queryRunner.query(`ALTER TABLE "detalle_reserva" DROP COLUMN "precio_lista"`);
        await queryRunner.query(`ALTER TABLE "variante_producto" DROP COLUMN "costo_promedio"`);
    }

}
