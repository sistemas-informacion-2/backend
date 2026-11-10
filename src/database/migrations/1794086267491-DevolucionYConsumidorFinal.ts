import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * R8: cada linea devuelta apunta a la linea de venta de la que sale, y el cliente generico de mostrador queda marcado
 * para que los analisis de clientes lo excluyan. Rellena los datos existentes con las mismas reglas que el codigo.
 */
export class DevolucionYConsumidorFinal1794086267491 implements MigrationInterface {
  name = 'DevolucionYConsumidorFinal1794086267491';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "cliente" ADD "es_consumidor_final" boolean NOT NULL DEFAULT false`);
    // Mismo correo que EMAIL_CONSUMIDOR_FINAL en ventas.service (unico por empresa).
    await queryRunner.query(
      `UPDATE "cliente" c SET "es_consumidor_final" = true FROM "usuario" u WHERE u.id = c.id_usuario AND u.email = 'consumidor.final@fashionstore.local'`,
    );

    await queryRunner.query(`ALTER TABLE "detalle_nota_devolucion" ADD "id_detalle_nota_venta" integer`);
    await queryRunner.query(
      `ALTER TABLE "detalle_nota_devolucion" ADD CONSTRAINT "FK_4ac7b3874da3e1d105553a8863b" FOREIGN KEY ("id_detalle_nota_venta") REFERENCES "detalle_nota_venta"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    // Como DevolucionesService.agruparLineas: la primera linea de la nota con esa variante.
    await queryRunner.query(`
      UPDATE "detalle_nota_devolucion" dd
         SET "id_detalle_nota_venta" = (
               SELECT MIN(dnv.id)
                 FROM "nota_devolucion" nd
                 JOIN "detalle_nota_venta" dnv ON dnv.id_nota_venta = nd.id_nota_venta
                WHERE nd.id = dd.id_nota_devolucion AND dnv.id_variante_producto = dd.id_variante_producto)
       WHERE dd.id_variante_producto IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "detalle_nota_devolucion" DROP CONSTRAINT "FK_4ac7b3874da3e1d105553a8863b"`);
    await queryRunner.query(`ALTER TABLE "detalle_nota_devolucion" DROP COLUMN "id_detalle_nota_venta"`);
    await queryRunner.query(`ALTER TABLE "cliente" DROP COLUMN "es_consumidor_final"`);
  }
}
