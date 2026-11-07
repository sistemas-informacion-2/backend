import type { QueryRunner } from 'typeorm';

/**
 * Helpers para migraciones escritas o corregidas a mano. Viven fuera de
 * migrations/ para que la CLI no los cargue como si fueran una migracion.
 */

/**
 * Quita el UNIQUE de una sola columna buscandolo por columna y no por nombre:
 * los nombres (UQ_xxx) dependen de como se creo cada base (synchronize o el
 * script SQL), asi que no se pueden escribir fijos.
 */
export async function quitarUniqueDeColumna(queryRunner: QueryRunner, tabla: string, columna: string): Promise<void> {
  const restricciones: Array<{ nombre: string }> = await queryRunner.query(
    `SELECT con.conname AS nombre
       FROM pg_constraint con
       JOIN pg_class t ON t.oid = con.conrelid
       JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (con.conkey)
      WHERE t.relname = $1 AND con.contype = 'u' AND a.attname = $2 AND array_length(con.conkey, 1) = 1`,
    [tabla, columna],
  );
  for (const { nombre } of restricciones) {
    await queryRunner.query(`ALTER TABLE "${tabla}" DROP CONSTRAINT "${nombre}"`);
  }
}

/**
 * Agrega id_empresa a una tabla con datos: la crea nullable, asigna todas las
 * filas existentes a la empresa inicial y, si corresponde, la vuelve NOT NULL.
 */
export async function agregarEmpresaATabla(
  queryRunner: QueryRunner,
  tabla: string,
  opciones: { obligatoria: boolean },
): Promise<void> {
  await queryRunner.query(`ALTER TABLE "${tabla}" ADD "id_empresa" integer`);
  await queryRunner.query(`UPDATE "${tabla}" SET "id_empresa" = ${ID_EMPRESA_INICIAL}`);
  if (opciones.obligatoria) {
    await queryRunner.query(`ALTER TABLE "${tabla}" ALTER COLUMN "id_empresa" SET NOT NULL`);
  }
}

/** Empresa que crea la migracion CrearEmpresa y a la que pasan todos los datos previos al SaaS. */
export const ID_EMPRESA_INICIAL = 1;
