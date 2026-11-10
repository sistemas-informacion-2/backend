import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * R7 del BI: cada movimiento de caja tiene categoria (y subcategoria si es un gasto operativo). Los existentes se
 * clasifican por el prefijo que les pone el sistema; los manuales, que no se pueden saber, quedan como OTRO_*.
 */
export class CategoriaMovimientoCaja1794083709180 implements MigrationInterface {
    name = 'CategoriaMovimientoCaja1794083709180'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "movimiento_caja" ADD "categoria" character varying(30)`);
        await queryRunner.query(`
            UPDATE "movimiento_caja" SET "categoria" = CASE
                WHEN "concepto" LIKE 'Venta presencial %' THEN 'VENTA'
                WHEN "concepto" LIKE 'Anticipo reserva %' THEN 'ANTICIPO_RESERVA'
                WHEN "concepto" LIKE 'Saldo reserva %' THEN 'SALDO_RESERVA'
                WHEN "concepto" LIKE 'Compra %' AND "tipo" = 'EGRESO' THEN 'COMPRA'
                WHEN "concepto" LIKE 'Reembolso devolucion %' THEN 'REEMBOLSO'
                WHEN "tipo" = 'INGRESO' THEN 'OTRO_INGRESO'
                ELSE 'OTRO_EGRESO'
            END`);
        await queryRunner.query(`ALTER TABLE "movimiento_caja" ALTER COLUMN "categoria" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "movimiento_caja" ADD "subcategoria_gasto" character varying(30)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "movimiento_caja" DROP COLUMN "subcategoria_gasto"`);
        await queryRunner.query(`ALTER TABLE "movimiento_caja" DROP COLUMN "categoria"`);
    }

}
