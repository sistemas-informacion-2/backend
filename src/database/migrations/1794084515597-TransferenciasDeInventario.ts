import type { MigrationInterface, QueryRunner } from 'typeorm';

/** R6: traslados de stock entre almacenes; cada uno deja su salida y su entrada en movimiento_inventario. */
export class TransferenciasDeInventario1794084515597 implements MigrationInterface {
  name = 'TransferenciasDeInventario1794084515597';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "transferencia_inventario" ("id" SERIAL NOT NULL, "id_empresa" integer NOT NULL, "id_almacen_origen" integer NOT NULL, "id_almacen_destino" integer NOT NULL, "id_variante_producto" integer NOT NULL, "cantidad" integer NOT NULL, "motivo" character varying(255), "id_usuario" integer, "fecha_hora" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f4481344724ab0095b9133e7963" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "idx_transferencia_empresa_fecha" ON "transferencia_inventario" ("id_empresa", "fecha_hora")`);
    await queryRunner.query(
      `ALTER TABLE "transferencia_inventario" ADD CONSTRAINT "FK_8451c3befde2c7c1ac5ecd63b4f" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "transferencia_inventario" ADD CONSTRAINT "FK_b64e5b3ae4339f295e1fadf79b0" FOREIGN KEY ("id_almacen_origen") REFERENCES "almacen"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "transferencia_inventario" ADD CONSTRAINT "FK_a0503ab25047f85efe2da84775a" FOREIGN KEY ("id_almacen_destino") REFERENCES "almacen"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "transferencia_inventario" ADD CONSTRAINT "FK_8fd4ed0b2dce77a4b0b77d2b7ea" FOREIGN KEY ("id_variante_producto") REFERENCES "variante_producto"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "transferencia_inventario" DROP CONSTRAINT "FK_8fd4ed0b2dce77a4b0b77d2b7ea"`);
    await queryRunner.query(`ALTER TABLE "transferencia_inventario" DROP CONSTRAINT "FK_a0503ab25047f85efe2da84775a"`);
    await queryRunner.query(`ALTER TABLE "transferencia_inventario" DROP CONSTRAINT "FK_b64e5b3ae4339f295e1fadf79b0"`);
    await queryRunner.query(`ALTER TABLE "transferencia_inventario" DROP CONSTRAINT "FK_8451c3befde2c7c1ac5ecd63b4f"`);
    await queryRunner.query(`DROP INDEX "public"."idx_transferencia_empresa_fecha"`);
    await queryRunner.query(`DROP TABLE "transferencia_inventario"`);
  }
}
