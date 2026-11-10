import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Modo sin conexion (RF-SYNC-01) y notificaciones Web Push, que nacieron con `synchronize` en otra rama: las bases
 * de esa rama ya tienen estas tablas y columnas, asi que cada paso se salta si ya existe. En una base nueva lo crea.
 *
 * - solicitud_idempotente: escrituras hechas sin conexion que ya llegaron, para no aplicarlas dos veces.
 * - suscripcion_web_push: navegadores donde cada usuario recibe avisos push (como dispositivo_push, sin empresa:
 *   pertenecen al usuario).
 * - id_local_offline: id que el dispositivo dio a la compra sin conexion (en reserva queda por las ya sincronizadas).
 */
export class ModoOfflineYWebPush1794200000000 implements MigrationInterface {
    name = 'ModoOfflineYWebPush1794200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await queryRunner.hasTable('solicitud_idempotente'))) {
            await queryRunner.query(`CREATE TABLE "solicitud_idempotente" ("clave" character varying(64) NOT NULL, "id_usuario" integer NOT NULL, "estado" character varying(12) NOT NULL, "respuesta" jsonb, "fecha_creacion" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_solicitud_idempotente" PRIMARY KEY ("clave"))`);
        }

        if (!(await queryRunner.hasTable('suscripcion_web_push'))) {
            await queryRunner.query(`CREATE TABLE "suscripcion_web_push" ("id" SERIAL NOT NULL, "id_usuario" integer NOT NULL, "endpoint" text NOT NULL, "p256dh" character varying(255) NOT NULL, "auth" character varying(100) NOT NULL, "fecha_actualizacion" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_suscripcion_web_push_endpoint" UNIQUE ("endpoint"), CONSTRAINT "PK_suscripcion_web_push" PRIMARY KEY ("id"))`);
            // Mismo nombre que genera TypeORM para esta relacion, para que migration:generate no la vuelva a crear.
            await queryRunner.query(`ALTER TABLE "suscripcion_web_push" ADD CONSTRAINT "FK_de30cab283391330dabe658b8a4" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        }

        if (!(await queryRunner.hasColumn('carrito', 'id_local_offline'))) {
            await queryRunner.query(`ALTER TABLE "carrito" ADD "id_local_offline" character varying(50)`);
        }
        if (!(await queryRunner.hasColumn('nota_venta', 'id_local_offline'))) {
            await queryRunner.query(`ALTER TABLE "nota_venta" ADD "id_local_offline" character varying(50)`);
            await queryRunner.query(`ALTER TABLE "nota_venta" ADD CONSTRAINT "UQ_nota_venta_id_local_offline" UNIQUE ("id_local_offline")`);
        }
        if (!(await queryRunner.hasColumn('reserva', 'id_local_offline'))) {
            await queryRunner.query(`ALTER TABLE "reserva" ADD "id_local_offline" character varying(40)`);
            await queryRunner.query(`ALTER TABLE "reserva" ADD CONSTRAINT "UQ_reserva_id_local_offline" UNIQUE ("id_local_offline")`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reserva" DROP COLUMN IF EXISTS "id_local_offline"`);
        await queryRunner.query(`ALTER TABLE "nota_venta" DROP COLUMN IF EXISTS "id_local_offline"`);
        await queryRunner.query(`ALTER TABLE "carrito" DROP COLUMN IF EXISTS "id_local_offline"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "suscripcion_web_push"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "solicitud_idempotente"`);
    }

}
