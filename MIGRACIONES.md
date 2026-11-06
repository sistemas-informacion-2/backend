# Migraciones de base de datos

El esquema de la base **solo** lo cambian las migraciones de TypeORM, que están en `src/database/migrations/`. `synchronize` está apagado en todos los entornos, porque podía borrar columnas y sus datos.

## Cómo se aplican

Al arrancar, la API aplica sola las migraciones pendientes (`migrationsRun: true` en `src/database/database.config.ts`), antes de los seeders de `main.ts`. Esto vale para local, Railway y AWS: nadie tiene que correr nada a mano en producción.

TypeORM anota en la tabla `migrations` cuáles ya se aplicaron, y nunca repite una.

## Migración base: `EsquemaInicial`

Es una foto de las 40 tablas como las dejaba `synchronize`.

- **En una base vacía** crea todo el esquema.
- **En una base que ya existía** (desarrollo local, Railway) detecta la tabla `usuario`, no hace nada y solo queda registrada como aplicada.
- **No se puede revertir**, porque borraría todas las tablas. Solo se permite con `PERMITIR_REVERTIR_ESQUEMA_INICIAL=true`.

## Flujo para cambiar el esquema

1. Cambia la entidad (`*.entity.ts`).
2. Genera la migración comparando las entidades con **tu base local**:
   ```bash
   npm run migration:generate -- src/database/migrations/NombreDelCambio
   ```
3. **Revisa el archivo generado.** Si el cambio necesita mover o llenar datos (por ejemplo, una columna nueva `NOT NULL` en una tabla con filas), edítalo así: agrega la columna como nullable, llénala con un `UPDATE` y recién después ponle `SET NOT NULL`.
4. Aplícala en local con `npm run migration:run`, o simplemente arranca la API.
5. Haz commit de la entidad y la migración **juntas**.

Para una migración solo de datos, o escrita a mano, usa `npm run migration:create -- src/database/migrations/NombreDelCambio`.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run migration:show` | Lista las migraciones y marca cuáles están aplicadas |
| `npm run migration:run` | Aplica las pendientes |
| `npm run migration:revert` | Revierte la última aplicada (ejecuta su `down`) |
| `npm run migration:generate -- <ruta>` | Genera una migración con la diferencia entre las entidades y la base |
| `npm run migration:create -- <ruta>` | Crea una migración vacía |

Los comandos usan `src/database/data-source.ts`, que lee `backend/.env`. Para apuntar a otra base sin tocar el archivo, antepón la variable: `DB_NAME=otra_base npm run migration:show`.

## Antes de desplegar migraciones nuevas

Haz un respaldo de la base de producción. Si la migración mueve datos, pruébala antes contra una copia: en Postgres, `CREATE DATABASE copia TEMPLATE original`.
