# Especificación Detallada de Funcionalidades - Ciclo #2

---

## CU16 – Gestionar Métodos de Pago

**Actor:** Administrador (A)

**Prioridad:** Media

**Módulo:** `backend/src/modules/comercial` — Frontend `frontend/src/modules/comercial`

### Descripción funcional

Permite administrar el catálogo de métodos de pago del sistema y **habilitarlos de forma independiente por canal**: `presencial` (cobro en caja, CU15) y `en línea` (e-commerce, CU12/CU13). Cada método se identifica por un `codigo` estable (`EFECTIVO`, `QR`, `TARJETA`, `PAYPAL`) y muestra un nombre visible editable (`metodo`).

Un método puede requerir integración (`integracion = API`) y credenciales (API Key / Secret). Mientras un método con integración API no tenga credenciales, no puede habilitarse en ningún canal.

### Reglas de negocio

1. **Código único y estable:** se normaliza a mayúsculas y no se puede repetir ni modificar tras la creación.
2. **Disponibilidad por canal:** dos banderas independientes, `disponiblePresencial` y `disponibleLinea`. No existe un interruptor global.
3. **Integración:** `NINGUNA` o `API`.
4. **Credenciales:** un método `API` sin credenciales no puede tener ningún canal habilitado:
   * Al crear/editar con un canal habilitado → `400 Bad Request`.
   * Al habilitar por canal (`PATCH /disponibilidad`) → `409 Conflict`.
5. **Credenciales cifradas:** `apiKey` y `apiSecret` se guardan cifrados con AES-256-GCM (`iv:authTag:ciphertext` en base64) usando `PAGOS_ENCRYPTION_KEY`. Nunca se devuelven al frontend; solo se expone `tieneApiKey` y `origenCredenciales` (`PANEL` / `NINGUNA`).
6. **Auditoría:** las mutaciones se registran en `BITACORA`; `apiKey`, `apiSecret` y `clientSecret` están excluidos de los campos auditados.

### Flujo principal

1. **Listar métodos de pago (`GET /api/comercial/pasarelas`):**
   * Devuelve todos los métodos con filtros por `search` (código/nombre), `integracion`, `disponiblePresencial` y `disponibleLinea`.

2. **Crear método (`POST /api/comercial/pasarelas`):**
   * Recibe `codigo`, `metodo`, `descripcion`, `integracion`, `comisionPorcentaje`, `disponiblePresencial`, `disponibleLinea` y, si es `API`, `apiKey`/`apiSecret`.
   * Valida código único, cifra las credenciales y persiste el registro.

3. **Editar método (`PUT /api/comercial/pasarelas/:id`):**
   * Actualiza nombre, descripción, integración, comisión y canales.
   * Si llegan credenciales nuevas se re-cifran; si no, se conservan las existentes.

4. **Habilitar / deshabilitar por canal (`PATCH /api/comercial/pasarelas/:id/disponibilidad`):**
   * Recibe `{ presencial?: boolean, linea?: boolean }`.
   * Si el método es `API` sin credenciales y se intenta habilitar → `409`.

5. **Consultar métodos disponibles para cobrar:**
   * **Caja (CU15):** `GET /api/comercial/pasarelas/presencial` → solo `disponiblePresencial = true`.
   * **E-commerce (CU12/CU13):** `GET /api/comercial/pasarelas/linea` → solo `disponibleLinea = true`.
   * La venta referencia el método en `NOTA_VENTA.id_pasarela` / `PAGO.id_pasarela`.

6. **Siembra inicial (arranque / `npm run seed`):**
   * Idempotente por `codigo`. Crea los métodos base y reconcilia `integracion` (y los canales solo si nunca se configuraron, para no revertir cambios del administrador).

### Métodos de pago base (siembra)

| Código | Método | Integración | Presencial | En línea |
| --- | --- | --- | --- | --- |
| `EFECTIVO` | Efectivo | NINGUNA | Sí | No |
| `QR` | QR | NINGUNA | Sí | Sí |
| `TARJETA` | Tarjeta | NINGUNA | Sí | Sí |
| `PAYPAL` | PayPal | API | No | No (requiere credenciales) |

### Endpoints y permisos

| Método | Endpoint | Permiso |
| --- | --- | --- |
| GET | `/api/comercial/pasarelas` | `comercial:pasarelas:gestionar` |
| GET | `/api/comercial/pasarelas/presencial` | `comercial:pasarelas:leer` |
| GET | `/api/comercial/pasarelas/linea` | `comercial:pasarelas:leer` |
| GET | `/api/comercial/pasarelas/:id` | `comercial:pasarelas:gestionar` |
| POST | `/api/comercial/pasarelas` | `comercial:pasarelas:gestionar` |
| PUT | `/api/comercial/pasarelas/:id` | `comercial:pasarelas:gestionar` |
| PATCH | `/api/comercial/pasarelas/:id/disponibilidad` | `comercial:pasarelas:gestionar` |

> El rol `ADMINISTRADOR` accede siempre. Los roles `ENCARGADO_SUCURSAL` y `VENDEDOR_CAJERO` reciben `comercial:pasarelas:leer` para consumir los métodos desde caja.

### Configuración

* `PAGOS_ENCRYPTION_KEY`: clave de 32 bytes (64 caracteres hex o base64) para el cifrado de credenciales. Si no está definida, guardar credenciales falla.

### Tablas implicadas

| Tabla | Operación | Motivo |
| --- | --- | --- |
| `pasarela_de_pago` | CRUD | Catálogo de métodos de pago y su disponibilidad por canal |
| `bitacora` | Escritura | Auditoría de las operaciones de creación/edición |

### Integración API / pasarela

`integracion = API` es una bandera de comportamiento con dos efectos:

1. **Bloquea la habilitación sin credenciales:** un método `API` sin `api_key_encriptada` no puede tener ningún canal activo (`400` al crear/editar con canal habilitado, `409` al habilitar por canal).
2. **Marca que el cobro debe resolverse mediante una pasarela** (p. ej. PayPal), a diferencia de `NINGUNA` (efectivo/QR/tarjeta manuales).

**Alcance actual (CU16):** solo configuración y resguardo de credenciales. **No** se realizan llamadas a la pasarela.

**Guardado de credenciales:**

* Se arma el JSON `{"apiKey":"...","apiSecret":"..."}`.
* Se cifra con **AES-256-GCM** (`common/utils/crypto.util.ts`) usando `PAGOS_ENCRYPTION_KEY`.
* Se guarda en `pasarela_de_pago.api_key_encriptada` con formato `iv:authTag:ciphertext` (base64).
* La respuesta **nunca** devuelve el secreto: solo `tieneApiKey` y `origenCredenciales` (`PANEL` / `NINGUNA`).

Ejemplo:

```http
POST /api/comercial/pasarelas
{
  "codigo": "PAYPAL",
  "metodo": "PayPal",
  "integracion": "API",
  "disponibleLinea": true,
  "apiKey": "<client-id>",
  "apiSecret": "<client-secret>"
}
```

```json
{ "data": { "codigo": "PAYPAL", "integracion": "API",
  "disponibleLinea": true, "tieneApiKey": true, "origenCredenciales": "PANEL" } }
```

**Trabajo futuro (checkout CU12/CU13):** el cobro real con la pasarela no pertenece a este CU. Flujo previsto:

1. Caja/e-commerce obtiene el método activo (`GET /comercial/pasarelas/presencial` o `/linea`).
2. Si `codigo = PAYPAL`, un servicio de gateway descifra `api_key_encriptada` con `decrypt(...)`.
3. **OAuth:** `POST https://api-m.sandbox.paypal.com/v1/oauth2/token` (Basic `client_id:secret`, `grant_type=client_credentials`) → `access_token`.
4. **Crear orden:** `POST /v2/checkout/orders` → link de aprobación.
5. **Capturar:** `POST /v2/checkout/orders/{id}/capture` tras la aprobación.
6. Registrar `PAGO` (`id_pasarela`, `concepto = PAGO_TOTAL`) y actualizar `NOTA_VENTA`.
7. Config de soporte: `mode` (sandbox/live), `currency`, `locale`, `exchange_rate`.

> Nota: `decrypt()` está implementado pero aún no se consume en ningún servicio.

### Notas / trabajo futuro

* La integración real con PayPal (OAuth, crear/capturar orden, webhooks) corresponde al checkout (**CU12/CU13**), no a este CU. CU16 solo administra el método y sus credenciales.
* La comisión (`comision_porcentaje`) queda registrada para su uso en el cálculo de pagos.
* Un método deshabilitado en un canal deja de aparecer en la consulta correspondiente, sin afectar las ventas ya registradas.
