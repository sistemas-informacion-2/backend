import type { MigrationInterface, QueryRunner } from 'typeorm';

const PERMISOS = ['analitica:bi:usar', 'analitica:bi:etl'];

/**
 * Permisos del BI. El seeder los crea en cada arranque, pero solo completa el rol ADMINISTRADOR de la empresa
 * inicial: aqui se asignan al ADMINISTRADOR de todas las empresas (el administrador tiene acceso total) y el uso del
 * asistente al ENCARGADO_SUCURSAL, que ya ve los reportes. Las empresas nuevas los reciben del aprovisionamiento.
 */
export class PermisosBi1794169589483 implements MigrationInterface {
  name = 'PermisosBi1794169589483';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const accion of PERMISOS) {
      await queryRunner.query(
        `INSERT INTO "permiso" ("accion") SELECT $1::varchar WHERE NOT EXISTS (SELECT 1 FROM "permiso" WHERE "accion" = $1::varchar)`,
        [accion],
      );
    }
    await this.asignar(queryRunner, 'ADMINISTRADOR', PERMISOS);
    await this.asignar(queryRunner, 'ENCARGADO_SUCURSAL', ['analitica:bi:usar']);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "rol_permiso" WHERE "id_permiso" IN (SELECT "id" FROM "permiso" WHERE "accion" = ANY($1))`, [PERMISOS]);
    await queryRunner.query(`DELETE FROM "permiso" WHERE "accion" = ANY($1)`, [PERMISOS]);
  }

  private async asignar(queryRunner: QueryRunner, rol: string, acciones: string[]): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "rol_permiso" ("id_rol", "id_permiso")
       SELECT r."id", p."id" FROM "rol" r CROSS JOIN "permiso" p
        WHERE r."nombre" = $1 AND p."accion" = ANY($2)
          AND NOT EXISTS (SELECT 1 FROM "rol_permiso" rp WHERE rp."id_rol" = r."id" AND rp."id_permiso" = p."id")`,
      [rol, acciones],
    );
  }
}
