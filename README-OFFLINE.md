# Modo offline: instalación en el backend

Guía para integrar el modo offline en otra rama. La contraparte del navegador está en `README-OFFLINE.md` del repositorio `frontend`: **hacen falta los dos**.

## 1. Traer los cambios

```bash
git fetch origin
```

```bash
git merge origin/backRamaNico
```

## 2. Dependencias

**El modo offline no agrega ningún paquete al backend.** Usa lo que ya está instalado (NestJS, TypeORM, `class-validator`, RxJS). Ejecuta esto solo para alinear tu `node_modules` con la rama:

```bash
npm install
```

## 3. Variables de entorno

No hay variables nuevas. El único cambio es que `CORS_ORIGIN` acepta varios orígenes separados por coma, necesario para probar el build de producción del frontend:

```env
CORS_ORIGIN=http://localhost:5173,http://localhost:4173
```

## 4. Base de datos

| Cambio | Para qué |
|---|---|
| Tabla nueva `solicitud_idempotente` | Evita aplicar dos veces un cambio reenviado |
| `nota_venta.id_local_offline` (única) | Evita registrar dos veces una compra offline |
| `carrito.id_local_offline` | Indica qué compra offline se está pagando |
| `reserva.id_local_offline` (única) | Histórico: ya no se llena, pero conserva los registros existentes |

**En desarrollo** se crean solos al arrancar, porque `synchronize` está activo cuando `NODE_ENV` no es `production`.

**En producción** `synchronize` está apagado. Ejecuta esto antes de publicar:

```sql
CREATE TABLE IF NOT EXISTS solicitud_idempotente (
  clave varchar(64) PRIMARY KEY,
  id_usuario int NOT NULL,
  estado varchar(12) NOT NULL,
  respuesta jsonb,
  fecha_creacion timestamp NOT NULL DEFAULT now()
);

ALTER TABLE nota_venta ADD COLUMN IF NOT EXISTS id_local_offline varchar(50) UNIQUE;
ALTER TABLE carrito ADD COLUMN IF NOT EXISTS id_local_offline varchar(50);
ALTER TABLE reserva ADD COLUMN IF NOT EXISTS id_local_offline varchar(40) UNIQUE;
```

## 5. Levantar el servidor

Después de integrar los cambios **hay que reiniciar el backend**:

```bash
npm run start:dev
```

## 6. Código que se agrega o cambia

| Ubicación | Función |
|---|---|
| `src/common/interceptors/idempotencia.interceptor.ts` | Con la cabecera `Idempotency-Key`, un reenvío devuelve la respuesta original |
| `src/common/entities/solicitud-idempotente.entity.ts` | Tabla donde se guardan esas respuestas |
| `src/common/interceptors/audit.interceptor.ts` | No registra dos veces en la bitácora un reenvío |
| `src/modules/electronico/services/compras-offline.service.ts` | Valida el stock de una compra offline y la deja lista para pagar |
| `src/modules/electronico/controllers/checkout-offline.controller.ts` | `POST` y `GET /api/electronico/checkout/sync` |
| `src/modules/electronico/dto/compra-offline.dto.ts` | Datos de la compra offline |
| `src/modules/electronico/services/checkout.service.ts` | Pasa el id de la compra offline a la Nota de Venta |
| `src/modules/comercial/services/ventas.service.ts` | Conserva la fecha real de una venta hecha sin conexión (`fechaOffline`, hasta 7 días) |

## 7. Comprobar que funciona

```bash
npm test
```

Después sigue la sección "Comprobar que funciona" del README del frontend.

## Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| "El identificador local del pedido no es válido" | El proceso sigue con el código antiguo | Detén el backend y vuelve a levantarlo |
| `column ... id_local_offline does not exist` | Producción sin el SQL de la sección 4 | Ejecuta ese SQL |
| Una compra offline vuelve con 409 | Se agotó el stock durante el corte | Es el comportamiento esperado: se avisa al cliente y no se cobra |
