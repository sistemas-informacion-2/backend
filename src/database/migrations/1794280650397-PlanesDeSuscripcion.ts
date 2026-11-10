import { MigrationInterface, QueryRunner } from "typeorm";

interface PlanSemilla {
    codigo: string;
    nombre: string;
    descripcion: string;
    precio: number;
    duracionDias: number;
    maxUsuarios: number | null;
    maxSucursales: number | null;
    maxAlmacenes: number | null;
    reportesAvanzados: boolean;
    bi: boolean;
    esPrueba: boolean;
    destacado: boolean;
    capacidades: string[];
    orden: number;
}

/** Los planes con que arranca DOMINATR. Despues se editan en la tabla; esta lista no se vuelve a leer. */
const PLANES: PlanSemilla[] = [
    {
        codigo: 'PRUEBA',
        nombre: 'Prueba gratuita',
        descripcion: 'Conoce todo DOMINATR antes de decidir. Sin costo y sin tarjeta.',
        precio: 0,
        duracionDias: 7,
        maxUsuarios: 3,
        maxSucursales: 1,
        maxAlmacenes: 1,
        reportesAvanzados: true,
        bi: true,
        esPrueba: true,
        destacado: false,
        capacidades: [
            'Todas las funciones de DOMINATR durante 7 días',
            'Tienda en línea, ventas en mostrador y caja',
            'Inventario con kardex, compras y proveedores',
            'Reportes con IA y asistente de BI',
            'Sin tarjeta y sin compromiso de permanencia',
        ],
        orden: 0,
    },
    {
        codigo: 'EMPRENDEDOR',
        nombre: 'Emprendedor',
        descripcion: 'Para microempresas y comercios que empiezan a vender en línea.',
        precio: 149,
        duracionDias: 30,
        maxUsuarios: 20,
        maxSucursales: 1,
        maxAlmacenes: 1,
        reportesAvanzados: false,
        bi: false,
        esPrueba: false,
        destacado: false,
        capacidades: [
            'Tienda en línea con pago por tarjeta y QR',
            'Ventas en mostrador, y caja con apertura, cierre y arqueo',
            'Catálogo con tallas, colores y temporadas',
            'Inventario con kardex, compras y proveedores',
            'Reservas, devoluciones y clientes',
            'Dashboard y reportes predefinidos',
            'Tus datos aislados de otras empresas',
        ],
        orden: 1,
    },
    {
        codigo: 'PROFESIONAL',
        nombre: 'Profesional',
        descripcion: 'Para empresas con varios puntos de venta.',
        precio: 349,
        duracionDias: 30,
        maxUsuarios: 100,
        maxSucursales: 3,
        maxAlmacenes: 5,
        reportesAvanzados: true,
        bi: false,
        esPrueba: false,
        destacado: true,
        capacidades: [
            'Todo lo del plan Emprendedor',
            'Multialmacén y transferencias de stock',
            'Constructor de reportes a medida',
            'Reportes generativos con IA',
            'Roles, permisos y bitácora de acciones',
        ],
        orden: 2,
    },
    {
        codigo: 'EMPRESARIAL',
        nombre: 'Empresarial',
        descripcion: 'Decisiones con datos e inteligencia artificial.',
        precio: 699,
        duracionDias: 30,
        maxUsuarios: 200,
        maxSucursales: 10,
        maxAlmacenes: 20,
        reportesAvanzados: true,
        bi: true,
        esPrueba: false,
        destacado: false,
        capacidades: [
            'Todo lo del plan Profesional',
            'Asistente de BI: pregunta en lenguaje natural sobre tu negocio',
            'Pronóstico de ventas y sugerencia de compra',
            'Segmentación de clientes y riesgo de abandono',
            'Detección de días anómalos y productos que se compran juntos',
        ],
        orden: 3,
    },
];

/**
 * Planes de DOMINATR: tabla `plan` con los cuatro planes, y en `empresa` su plan, el vencimiento y los datos
 * del registro (pais, ciudad, direccion, telefono). Las empresas que ya existen pasan al plan Empresarial sin
 * vencimiento: son las tiendas internas (fashionstore, demo-bi) y no deben quedar bloqueadas.
 */
export class PlanesDeSuscripcion1794280650397 implements MigrationInterface {
    name = 'PlanesDeSuscripcion1794280650397'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "plan" ("id" SERIAL NOT NULL, "codigo" character varying(30) NOT NULL, "nombre" character varying(60) NOT NULL, "descripcion" character varying(200) NOT NULL, "precio" numeric(10,2) NOT NULL, "duracion_dias" integer NOT NULL, "max_usuarios" integer, "max_sucursales" integer, "max_almacenes" integer, "reportes_avanzados" boolean NOT NULL DEFAULT false, "bi" boolean NOT NULL DEFAULT false, "es_prueba" boolean NOT NULL DEFAULT false, "destacado" boolean NOT NULL DEFAULT false, "capacidades" jsonb NOT NULL DEFAULT '[]', "activo" boolean NOT NULL DEFAULT true, "orden" integer NOT NULL DEFAULT 0, CONSTRAINT "UQ_plan_codigo" UNIQUE ("codigo"), CONSTRAINT "PK_plan" PRIMARY KEY ("id"))`);
        for (const plan of PLANES) {
            await queryRunner.query(
                `INSERT INTO "plan" ("codigo", "nombre", "descripcion", "precio", "duracion_dias", "max_usuarios", "max_sucursales", "max_almacenes", "reportes_avanzados", "bi", "es_prueba", "destacado", "capacidades", "orden") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14)`,
                [plan.codigo, plan.nombre, plan.descripcion, plan.precio, plan.duracionDias, plan.maxUsuarios, plan.maxSucursales, plan.maxAlmacenes, plan.reportesAvanzados, plan.bi, plan.esPrueba, plan.destacado, JSON.stringify(plan.capacidades), plan.orden],
            );
        }

        await queryRunner.query(`ALTER TABLE "empresa" ADD "pais" character varying(60) NOT NULL DEFAULT 'Bolivia'`);
        await queryRunner.query(`ALTER TABLE "empresa" ADD "ciudad" character varying(80)`);
        await queryRunner.query(`ALTER TABLE "empresa" ADD "direccion" character varying(200)`);
        await queryRunner.query(`ALTER TABLE "empresa" ADD "telefono" character varying(30)`);
        await queryRunner.query(`ALTER TABLE "empresa" ADD "plan_vence_el" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "empresa" ADD "id_plan" integer`);
        await queryRunner.query(`UPDATE "empresa" SET "id_plan" = (SELECT "id" FROM "plan" WHERE "codigo" = 'EMPRESARIAL')`);
        await queryRunner.query(`ALTER TABLE "empresa" ALTER COLUMN "id_plan" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "empresa" ADD CONSTRAINT "FK_74a19bb1d75021d7ee1409273b7" FOREIGN KEY ("id_plan") REFERENCES "plan"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);

        // NIT vacio no cuenta como repetido.
        await queryRunner.query(`UPDATE "empresa" SET "nit" = NULL WHERE trim("nit") = ''`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_empresa_nit" ON "empresa" ("nit") WHERE "nit" IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."uq_empresa_nit"`);
        await queryRunner.query(`ALTER TABLE "empresa" DROP CONSTRAINT "FK_74a19bb1d75021d7ee1409273b7"`);
        await queryRunner.query(`ALTER TABLE "empresa" DROP COLUMN "id_plan"`);
        await queryRunner.query(`ALTER TABLE "empresa" DROP COLUMN "plan_vence_el"`);
        await queryRunner.query(`ALTER TABLE "empresa" DROP COLUMN "telefono"`);
        await queryRunner.query(`ALTER TABLE "empresa" DROP COLUMN "direccion"`);
        await queryRunner.query(`ALTER TABLE "empresa" DROP COLUMN "ciudad"`);
        await queryRunner.query(`ALTER TABLE "empresa" DROP COLUMN "pais"`);
        await queryRunner.query(`DROP TABLE "plan"`);
    }

}
