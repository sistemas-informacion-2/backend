-- =============================================================================
-- ENUMS
-- =============================================================================
CREATE TYPE estado_reserva_enum AS ENUM ('PENDIENTE', 'PAGADA', 'CANCELADA', 'COMPLETADA');
CREATE TYPE tipo_nota_venta_enum AS ENUM ('DIRECTA_PRESENCIAL', 'ANTICIPO_RESERVA', 'PRESENCIAL_LIQUIDACION', 'E_COMMERCE');
CREATE TYPE concepto_pago_enum AS ENUM ('PAGO_TOTAL', 'ANTICIPO_RESERVA', 'SALDO_LIQUIDACION', 'REEMBOLSO');
CREATE TYPE tipo_devolucion_enum AS ENUM ('PRODUCTO_ENTREGADO', 'CANCELACION_RESERVA');
CREATE TYPE motivo_devolucion_enum AS ENUM ('FALLA_FABRICA', 'TALLA_INCORRECTA', 'ARREPENTIMIENTO', 'CANCELACION');
CREATE TYPE estado_producto_devolucion_enum AS ENUM ('REINGRESO_INVENTARIO', 'MERMA_DEFECTUOSO', 'NO_APLICA');
-- CU16: indica si el metodo de pago requiere credenciales de integracion.
CREATE TYPE integracion_pago_enum AS ENUM ('NINGUNA', 'API');

-- =============================================================================
-- 1. SECCIÓN DE SEGURIDAD, USUARIOS Y AUDITORÍA
-- =============================================================================

CREATE TABLE PERMISO (
    id SERIAL PRIMARY KEY,
    accion VARCHAR(100) NOT NULL,
    descripcion TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE ROL (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE ROL_PERMISO (
    id_rol INT NOT NULL,
    id_permiso INT NOT NULL,
    fecha_asignacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activo BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (id_rol, id_permiso),
    CONSTRAINT fk_rolpermiso_rol FOREIGN KEY (id_rol) REFERENCES ROL(id) ON DELETE CASCADE,
    CONSTRAINT fk_rolpermiso_permiso FOREIGN KEY (id_permiso) REFERENCES PERMISO(id) ON DELETE CASCADE
);

CREATE TABLE USUARIO (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    telefono VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    sexo CHAR(1),
    tipo_usuario CHAR(1) NOT NULL, -- 'A' Administrador, 'E' Empleado, 'C' Cliente (CU01)
    estado_acceso VARCHAR(20) NOT NULL DEFAULT 'HABILITADO', -- HABILITADO | BLOQUEADO | SUSPENDIDO (CU01)
    intentos_fallidos INT NOT NULL DEFAULT 0, -- se resetea al loguear, bloquea la cuenta al llegar a 5 (CU01)
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE ROL_USUARIO (
    id_rol INT NOT NULL,
    id_usuario INT NOT NULL,
    fecha_asignacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activo BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (id_rol, id_usuario),
    CONSTRAINT fk_rolusuario_rol FOREIGN KEY (id_rol) REFERENCES ROL(id) ON DELETE CASCADE,
    CONSTRAINT fk_rolusuario_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIO(id) ON DELETE CASCADE
);

CREATE TABLE SESION (
    id SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    refresh_token_hash VARCHAR(255) NOT NULL, -- SHA-256 del refresh token, nunca el token en claro
    ip_origen VARCHAR(45),
    user_agent TEXT,
    fecha_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_expiracion TIMESTAMP NOT NULL,
    fecha_cierre TIMESTAMP, -- NULL mientras la sesión sigue activa (CU01)
    CONSTRAINT fk_sesion_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIO(id) ON DELETE CASCADE
);

CREATE TABLE EMPLEADO (
    id_usuario INT PRIMARY KEY,
    codigo_empleado VARCHAR(50) NOT NULL UNIQUE,
    salario DECIMAL(12,2) NOT NULL,
    fecha_contratacion DATE NOT NULL,
    fecha_finalizacion DATE,
    CONSTRAINT fk_empleado_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIO(id) ON DELETE CASCADE
);

CREATE TABLE CLIENTE (
    id_usuario INT PRIMARY KEY,
    ciudad_residencia VARCHAR(100),
    direccion_principal TEXT,
    puntos_fidelidad INT DEFAULT 0,
    CONSTRAINT fk_cliente_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIO(id) ON DELETE CASCADE
);

CREATE TABLE BITACORA (
    id BIGSERIAL PRIMARY KEY,
    id_usuario INT,
    accion VARCHAR(100) NOT NULL,
    tabla_afectada VARCHAR(100) NOT NULL,
    ip_origen VARCHAR(45),
    user_agent TEXT,
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    fecha_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bitacora_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIO(id) ON DELETE SET NULL
);

CREATE TABLE NOTIFICACION_PUSH (
    id SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    titulo VARCHAR(150) NOT NULL,
    mensaje TEXT NOT NULL,
    leido BOOLEAN DEFAULT FALSE,
    fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notificacion_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIO(id) ON DELETE CASCADE
);

-- =============================================================================
-- 2. SECCIÓN DE UBICACIÓN, SUCURSALES E INVENTARIO
-- =============================================================================

CREATE TABLE DEPARTAMENTO (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL
);

CREATE TABLE CIUDAD (
    id SERIAL PRIMARY KEY,
    id_departamento INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    ubicacion TEXT,
    CONSTRAINT fk_ciudad_departamento FOREIGN KEY (id_departamento) REFERENCES DEPARTAMENTO(id) ON DELETE CASCADE
);

CREATE TABLE SUCURSAL (
    id SERIAL PRIMARY KEY,
    id_ciudad INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    correo VARCHAR(150),
    horario_apertura TIME,
    horario_cierre TIME,
    ubicacion VARCHAR(100) NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    CONSTRAINT fk_sucursal_ciudad FOREIGN KEY (id_ciudad) REFERENCES CIUDAD(id)
);

CREATE TABLE EMPLEADO_SUCURSAL (
    id_empleado INT NOT NULL,
    id_sucursal INT NOT NULL,
    fecha_asignacion DATE DEFAULT CURRENT_DATE,
    fecha_fin DATE, -- se completa al reasignar de sucursal (CU05)
    activo BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (id_empleado, id_sucursal),
    CONSTRAINT fk_emp_suc_empleado FOREIGN KEY (id_empleado) REFERENCES EMPLEADO(id_usuario) ON DELETE CASCADE,
    CONSTRAINT fk_emp_suc_sucursal FOREIGN KEY (id_sucursal) REFERENCES SUCURSAL(id) ON DELETE CASCADE
);

-- =============================================================================
-- 3. SECCIÓN DE CATÁLOGO Y PROVEEDORES
-- =============================================================================

CREATE TABLE PROVEEDOR (
    id SERIAL PRIMARY KEY,
    empresa VARCHAR(150) NOT NULL,
    nit VARCHAR(50) NOT NULL UNIQUE,
    nombre_contacto VARCHAR(100),
    telefono_contacto VARCHAR(20),
    correo_contacto VARCHAR(150),
    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE TEMPORADA (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    descripcion TEXT
);

CREATE TABLE CATEGORIA (
    id SERIAL PRIMARY KEY,
    id_categoria_padre INT,
    nombre VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL UNIQUE, -- URLs limpias para la barra de categorias del e-commerce (CU08)
    descripcion TEXT,
    imagen_url VARCHAR(500), -- imagen de la categoria, la pide CU08 explicitamente
    activo BOOLEAN DEFAULT TRUE,
    CONSTRAINT fk_categoria_padre FOREIGN KEY (id_categoria_padre) REFERENCES CATEGORIA(id) ON DELETE CASCADE
);

CREATE TABLE TEMPORADA_CATEGORIA (
    id_temporada INT NOT NULL,
    id_categoria INT NOT NULL,
    PRIMARY KEY (id_temporada, id_categoria),
    CONSTRAINT fk_tempcat_temporada FOREIGN KEY (id_temporada) REFERENCES TEMPORADA(id) ON DELETE CASCADE,
    CONSTRAINT fk_tempcat_categoria FOREIGN KEY (id_categoria) REFERENCES CATEGORIA(id) ON DELETE CASCADE
);

CREATE TABLE PRODUCTO (
    id SERIAL PRIMARY KEY,
    id_categoria INT NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    precio DECIMAL(12,2) NOT NULL,
    -- Porcentaje de descuento vigente (0 = sin descuento); alimenta el banner de ofertas del e-commerce.
    descuento_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    activo BOOLEAN DEFAULT TRUE,
    CONSTRAINT chk_producto_descuento CHECK (descuento_porcentaje >= 0 AND descuento_porcentaje <= 100),
    CONSTRAINT fk_producto_categoria FOREIGN KEY (id_categoria) REFERENCES CATEGORIA(id)
);

-- Catalogo global: el producto se crea una sola vez y cada sucursal decide si
-- lo activa, sin duplicar la fila de PRODUCTO ni su SKU por sucursal.
CREATE TABLE PRODUCTO_SUCURSAL (
    id_producto INT NOT NULL,
    id_sucursal INT NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (id_producto, id_sucursal),
    CONSTRAINT fk_prodsuc_producto FOREIGN KEY (id_producto) REFERENCES PRODUCTO(id) ON DELETE CASCADE,
    CONSTRAINT fk_prodsuc_sucursal FOREIGN KEY (id_sucursal) REFERENCES SUCURSAL(id) ON DELETE CASCADE
);

CREATE TABLE IMAGEN_PRODUCTO (
    id SERIAL PRIMARY KEY,
    id_producto INT NOT NULL,
    url VARCHAR(500) NOT NULL,
    es_principal BOOLEAN DEFAULT FALSE,
    orden INT DEFAULT 1,
    CONSTRAINT fk_imagen_producto FOREIGN KEY (id_producto) REFERENCES PRODUCTO(id) ON DELETE CASCADE
);

CREATE TABLE VARIANTE_PRODUCTO (
    id SERIAL PRIMARY KEY,
    id_producto INT NOT NULL,
    sku VARCHAR(100) NOT NULL UNIQUE,
    talla VARCHAR(20) NOT NULL,
    color VARCHAR(50) NOT NULL,
    corte VARCHAR(50) NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    CONSTRAINT fk_variante_producto FOREIGN KEY (id_producto) REFERENCES PRODUCTO(id) ON DELETE CASCADE
);

CREATE TABLE ALMACEN (
    id SERIAL PRIMARY KEY,
    id_sucursal INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    ubicacion_fisica TEXT,
    activo BOOLEAN DEFAULT TRUE,
    CONSTRAINT fk_almacen_sucursal FOREIGN KEY (id_sucursal) REFERENCES SUCURSAL(id) ON DELETE CASCADE
);

CREATE TABLE INVENTARIO (
    id SERIAL PRIMARY KEY,
    id_almacen INT NOT NULL,
    id_variante_producto INT NOT NULL,
    stock_disponible INT NOT NULL DEFAULT 0,
    stock_reservado INT NOT NULL DEFAULT 0,
    stock_minimo INT DEFAULT 5,
    stock_maximo INT DEFAULT 500,
    CONSTRAINT uq_almacen_variante UNIQUE(id_almacen, id_variante_producto),
    CONSTRAINT fk_stock_almacen FOREIGN KEY (id_almacen) REFERENCES ALMACEN(id),
    CONSTRAINT fk_stock_variante FOREIGN KEY (id_variante_producto) REFERENCES VARIANTE_PRODUCTO(id)
);

-- =============================================================================
-- 4. SECCIÓN DE TESORERÍA Y CAJA
-- =============================================================================

CREATE TABLE PASARELA_DE_PAGO (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(30) NOT NULL UNIQUE, -- clave estable: EFECTIVO, QR, TARJETA, PAYPAL (CU16)
    metodo VARCHAR(50) NOT NULL,
    descripcion TEXT,
    integracion integracion_pago_enum NOT NULL DEFAULT 'NINGUNA', -- CU16
    api_key_encriptada TEXT,
    comision_porcentaje DECIMAL(5,2) DEFAULT 0.00,
    disponible_presencial BOOLEAN NOT NULL DEFAULT FALSE, -- habilitado para caja (CU15)
    disponible_linea BOOLEAN NOT NULL DEFAULT FALSE -- habilitado para e-commerce (CU12/CU13)
);

CREATE TABLE CAJA (
    id SERIAL PRIMARY KEY,
    id_sucursal INT NOT NULL,
    id_cajero INT, -- CU15: cajero que abre/opera la caja (empleado.id_usuario)
    fecha_apertura TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_cierre TIMESTAMP,
    hora_apertura TIME NOT NULL DEFAULT CURRENT_TIME,
    hora_cierre TIME,
    monto_inicial DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    monto_final DECIMAL(12,2),
    estado VARCHAR(20) NOT NULL DEFAULT 'Abierta',
    CONSTRAINT fk_caja_sucursal FOREIGN KEY (id_sucursal) REFERENCES SUCURSAL(id),
    CONSTRAINT fk_caja_cajero FOREIGN KEY (id_cajero) REFERENCES EMPLEADO(id_usuario)
);

CREATE TABLE MOVIMIENTO_CAJA (
    id SERIAL PRIMARY KEY,
    id_caja INT NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    concepto VARCHAR(150) NOT NULL,
    monto DECIMAL(12,2) NOT NULL,
    observaciones TEXT,
    fecha_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_movcaja_caja FOREIGN KEY (id_caja) REFERENCES CAJA(id) ON DELETE CASCADE
);

-- =============================================================================
-- 5. SECCIÓN DE E-COMMERCE, RESERVAS Y VENTAS
-- =============================================================================

CREATE TABLE CARRITO (
    id SERIAL PRIMARY KEY,
    id_cliente INT NOT NULL UNIQUE,
    -- Sucursal elegida en el catalogo (CU08): de ahi sale el stock al pagar (CU14).
    id_sucursal INT,
    session_id VARCHAR(100),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_carrito_cliente FOREIGN KEY (id_cliente) REFERENCES CLIENTE(id_usuario) ON DELETE CASCADE,
    CONSTRAINT fk_carrito_sucursal FOREIGN KEY (id_sucursal) REFERENCES SUCURSAL(id)
);

CREATE TABLE DETALLE_CARRITO (
    id SERIAL PRIMARY KEY,
    id_carrito INT NOT NULL,
    id_variante_producto INT NOT NULL,
    precio_unitario DECIMAL(12,2) NOT NULL CHECK (precio_unitario >= 0),
    cantidad INT NOT NULL CHECK (cantidad > 0),
    subtotal DECIMAL(12,2) NOT NULL CHECK (subtotal >= 0),
    notas_especiales TEXT,
    fecha_agregado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_carrito_variante UNIQUE(id_carrito, id_variante_producto),
    CONSTRAINT fk_detcarrito_carrito FOREIGN KEY (id_carrito) REFERENCES CARRITO(id) ON DELETE CASCADE,
    CONSTRAINT fk_detcarrito_variante FOREIGN KEY (id_variante_producto) REFERENCES VARIANTE_PRODUCTO(id)
);

CREATE TABLE RESERVA (
    id SERIAL PRIMARY KEY,
    codigo_reserva VARCHAR(20) NOT NULL UNIQUE,
    id_cliente INT NOT NULL,
    id_sucursal INT NOT NULL,
    fecha_reserva TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_limite TIMESTAMP NOT NULL,
    estado estado_reserva_enum NOT NULL DEFAULT 'PENDIENTE',
    monto_anticipo DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (monto_anticipo >= 0),
    monto_total DECIMAL(12,2) NOT NULL CHECK (monto_total >= 0),
    observaciones TEXT,
    CONSTRAINT fk_reserva_cliente FOREIGN KEY (id_cliente) REFERENCES CLIENTE(id_usuario),
    CONSTRAINT fk_reserva_sucursal FOREIGN KEY (id_sucursal) REFERENCES SUCURSAL(id)
);

CREATE TABLE DETALLE_RESERVA (
    id SERIAL PRIMARY KEY,
    id_reserva INT NOT NULL,
    id_variante_producto INT NOT NULL,
    precio_unitario DECIMAL(12,2) NOT NULL CHECK (precio_unitario >= 0),
    cantidad INT NOT NULL CHECK (cantidad > 0),
    subtotal DECIMAL(12,2) NOT NULL CHECK (subtotal >= 0),
    CONSTRAINT fk_detreserva_reserva FOREIGN KEY (id_reserva) REFERENCES RESERVA(id) ON DELETE CASCADE,
    CONSTRAINT fk_detreserva_variante FOREIGN KEY (id_variante_producto) REFERENCES VARIANTE_PRODUCTO(id)
);

CREATE TABLE NOTA_VENTA (
    id SERIAL PRIMARY KEY,
    codigo_nota VARCHAR(20) NOT NULL UNIQUE,
    id_cliente INT NOT NULL,
    id_cajero INT,
    id_sucursal INT NOT NULL,
    id_pasarela INT,
    id_movimiento_caja INT,
    id_carrito INT,
    id_reserva INT,
    tipo VARCHAR(30) NOT NULL DEFAULT 'PRESENCIAL',
    tipo_venta tipo_nota_venta_enum NOT NULL,
    nro_factura VARCHAR(50) UNIQUE,
    nit_razon_social VARCHAR(50),
    fecha_emision DATE DEFAULT CURRENT_DATE,
    hora_emision TIME DEFAULT CURRENT_TIME,
    subtotal DECIMAL(12,2) NOT NULL,
    monto_anticipo_aplicado DECIMAL(12,2) DEFAULT 0.00,
    descuento DECIMAL(12,2) DEFAULT 0.00,
    impuesto DECIMAL(12,2) DEFAULT 0.00,
    monto_total DECIMAL(12,2) NOT NULL,
    estado_pago VARCHAR(30) DEFAULT 'Pagado',
    CONSTRAINT fk_notaventa_cliente FOREIGN KEY (id_cliente) REFERENCES CLIENTE(id_usuario),
    CONSTRAINT fk_notaventa_cajero FOREIGN KEY (id_cajero) REFERENCES EMPLEADO(id_usuario),
    CONSTRAINT fk_notaventa_sucursal FOREIGN KEY (id_sucursal) REFERENCES SUCURSAL(id),
    CONSTRAINT fk_notaventa_pasarela FOREIGN KEY (id_pasarela) REFERENCES PASARELA_DE_PAGO(id),
    CONSTRAINT fk_notaventa_movcaja FOREIGN KEY (id_movimiento_caja) REFERENCES MOVIMIENTO_CAJA(id),
    CONSTRAINT fk_notaventa_carrito FOREIGN KEY (id_carrito) REFERENCES CARRITO(id) ON DELETE SET NULL,
    CONSTRAINT fk_notaventa_reserva FOREIGN KEY (id_reserva) REFERENCES RESERVA(id) ON DELETE SET NULL
);

-- =============================================================================
-- 6. REGISTRO DE PAGOS (AHORA REFERENCIA DE FORMA LIMPIA A VENTA Y RESERVA)
-- =============================================================================

-- id_movimiento_caja es NULL en pagos en linea (PayPal, QR, tarjeta): no pasan por una caja fisica.
-- referencia_externa guarda el id de la transaccion en la pasarela (ej. orden de PayPal) y, al ser UNIQUE,
-- evita registrar dos veces el mismo cobro si el cliente recarga la pagina de retorno.
CREATE TABLE PAGO (
    id SERIAL PRIMARY KEY,
    id_movimiento_caja INT,
    id_pasarela INT,
    id_nota_venta INT,
    id_reserva INT,
    monto DECIMAL(12,2) NOT NULL CHECK (monto > 0),
    concepto concepto_pago_enum NOT NULL,
    referencia_externa VARCHAR(100) UNIQUE,
    fecha_pago DATE DEFAULT CURRENT_DATE,
    hora_pago TIME DEFAULT CURRENT_TIME,
    CONSTRAINT fk_pago_movcaja FOREIGN KEY (id_movimiento_caja) REFERENCES MOVIMIENTO_CAJA(id) ON DELETE RESTRICT,
    CONSTRAINT fk_pago_pasarela FOREIGN KEY (id_pasarela) REFERENCES PASARELA_DE_PAGO(id),
    CONSTRAINT fk_pago_notaventa FOREIGN KEY (id_nota_venta) REFERENCES NOTA_VENTA(id) ON DELETE RESTRICT,
    CONSTRAINT fk_pago_reserva FOREIGN KEY (id_reserva) REFERENCES RESERVA(id) ON DELETE RESTRICT
);

CREATE TABLE DETALLE_NOTA_VENTA (
    id SERIAL PRIMARY KEY,
    id_nota_venta INT NOT NULL,
    id_variante_producto INT,
    descripcion VARCHAR(255) NOT NULL,
    precio_unitario DECIMAL(12,2) NOT NULL,
    cantidad INT NOT NULL CHECK (cantidad > 0),
    subtotal DECIMAL(12,2) NOT NULL,
    CONSTRAINT fk_detventa_notaventa FOREIGN KEY (id_nota_venta) REFERENCES NOTA_VENTA(id) ON DELETE CASCADE,
    CONSTRAINT fk_detventa_variante FOREIGN KEY (id_variante_producto) REFERENCES VARIANTE_PRODUCTO(id)
);

CREATE TABLE NOTA_DEVOLUCION (
    id SERIAL PRIMARY KEY,
    codigo_devolucion VARCHAR(20) NOT NULL UNIQUE,
    id_cliente INT NOT NULL,
    id_sucursal INT NOT NULL,
    id_cajero INT NOT NULL,
    id_nota_venta INT,
    id_reserva INT,
    id_movimiento_caja INT,
    tipo_devolucion tipo_devolucion_enum NOT NULL,
    motivo_devolucion motivo_devolucion_enum NOT NULL,
    monto_total_reembolsado DECIMAL(12,2) NOT NULL CHECK (monto_total_reembolsado >= 0),
    observaciones TEXT,
    fecha_emision TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notadev_cliente FOREIGN KEY (id_cliente) REFERENCES CLIENTE(id_usuario),
    CONSTRAINT fk_notadev_sucursal FOREIGN KEY (id_sucursal) REFERENCES SUCURSAL(id),
    CONSTRAINT fk_notadev_cajero FOREIGN KEY (id_cajero) REFERENCES EMPLEADO(id_usuario),
    CONSTRAINT fk_notadev_notaventa FOREIGN KEY (id_nota_venta) REFERENCES NOTA_VENTA(id) ON DELETE SET NULL,
    CONSTRAINT fk_notadev_reserva FOREIGN KEY (id_reserva) REFERENCES RESERVA(id) ON DELETE SET NULL,
    CONSTRAINT fk_notadev_movcaja FOREIGN KEY (id_movimiento_caja) REFERENCES MOVIMIENTO_CAJA(id) ON DELETE SET NULL
);

CREATE TABLE DETALLE_NOTA_DEVOLUCION (
    id SERIAL PRIMARY KEY,
    id_nota_devolucion INT NOT NULL,
    id_variante_producto INT,
    id_almacen INT,
    descripcion VARCHAR(255) NOT NULL,
    precio_unitario DECIMAL(12,2) NOT NULL CHECK (precio_unitario >= 0),
    cantidad INT NOT NULL CHECK (cantidad > 0),
    monto_subtotal DECIMAL(12,2) NOT NULL CHECK (monto_subtotal >= 0),
    estado_producto estado_producto_devolucion_enum NOT NULL DEFAULT 'REINGRESO_INVENTARIO',
    CONSTRAINT fk_detdev_notadev FOREIGN KEY (id_nota_devolucion) REFERENCES NOTA_DEVOLUCION(id) ON DELETE CASCADE,
    CONSTRAINT fk_detdev_variante FOREIGN KEY (id_variante_producto) REFERENCES VARIANTE_PRODUCTO(id),
    CONSTRAINT fk_detdev_almacen FOREIGN KEY (id_almacen) REFERENCES ALMACEN(id)
);

-- =============================================================================
-- 7. SECCIÓN DE COMPRAS
-- =============================================================================

-- Toda compra pertenece a una sucursal: sus almacenes de destino (DETALLE_NOTA_COMPRA.id_almacen)
-- y la caja del egreso (id_movimiento_caja) deben ser de esa misma sucursal (regla de CU15).
CREATE TABLE NOTA_COMPRA (
    id SERIAL PRIMARY KEY,
    id_proveedor INT NOT NULL,
    id_sucursal INT NOT NULL,
    id_movimiento_caja INT,
    nro_factura VARCHAR(50),
    fecha_emision TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_entrega_programada DATE,
    fecha_pago DATE,
    subtotal DECIMAL(12,2) NOT NULL,
    total DECIMAL(12,2) NOT NULL,
    estado VARCHAR(30) DEFAULT 'Recibido',
    CONSTRAINT fk_notacompra_proveedor FOREIGN KEY (id_proveedor) REFERENCES PROVEEDOR(id),
    CONSTRAINT fk_notacompra_sucursal FOREIGN KEY (id_sucursal) REFERENCES SUCURSAL(id),
    CONSTRAINT fk_notacompra_movcaja FOREIGN KEY (id_movimiento_caja) REFERENCES MOVIMIENTO_CAJA(id)
);

CREATE TABLE DETALLE_NOTA_COMPRA (
    id SERIAL PRIMARY KEY,
    id_nota_compra INT NOT NULL,
    id_variante_producto INT NOT NULL,
    id_almacen INT NOT NULL,
    precio_unitario DECIMAL(12,2) NOT NULL,
    cantidad INT NOT NULL CHECK (cantidad > 0),
    subtotal DECIMAL(12,2) NOT NULL,
    nro_lote VARCHAR(50),
    CONSTRAINT fk_detcompra_notacompra FOREIGN KEY (id_nota_compra) REFERENCES NOTA_COMPRA(id) ON DELETE CASCADE,
    CONSTRAINT fk_detcompra_variante FOREIGN KEY (id_variante_producto) REFERENCES VARIANTE_PRODUCTO(id),
    CONSTRAINT fk_detcompra_almacen FOREIGN KEY (id_almacen) REFERENCES ALMACEN(id)
);

-- =============================================================================
-- 8. SECCIÓN DE REPORTES
-- =============================================================================

-- Plantilla guardada de un reporte dinamico (CU18): guarda la config completa
-- del Report Builder en `config` (jsonb) para poder reaplicarla con un clic.
-- La plantilla pertenece al usuario que la creo.
CREATE TABLE REPORTE_PLANTILLA (
    id SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    config JSONB NOT NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reporteplantilla_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIO(id) ON DELETE CASCADE
);

-- =============================================================================
-- SCRIPT DE POBLACION DE DATOS (datos de referencia realistas para demo/pruebas)
-- Generado a partir de un catalogo de moda boliviano ficticio. Reejecutable:
-- usa ON CONFLICT / subconsultas por clave natural en vez de IDs fijos, para no
-- chocar con los IDs que ya existan en tu base (categorias, ciudades, roles,
-- pasarelas y temporadas de estacion ya los siembra la app sola al arrancar).
--
-- Password de TODAS las cuentas demo (empleados y clientes creados aqui): FashionDemo2026*
-- =============================================================================

-- ===========================================================================
-- PROVEEDORES
-- ===========================================================================
INSERT INTO PROVEEDOR (empresa, nit, nombre_contacto, telefono_contacto, correo_contacto, activo)
VALUES ('Textiles Andinos S.R.L.', '1028347022', 'Ronald Mamani Choque', '71264389', 'ventas@textilesandinos.com.bo', true)
ON CONFLICT (nit) DO NOTHING;
INSERT INTO PROVEEDOR (empresa, nit, nombre_contacto, telefono_contacto, correo_contacto, activo)
VALUES ('Denim Boliviano S.A.', '1006521029', 'Cecilia Vargas Rocha', '76423801', 'pedidos@denimboliviano.com.bo', true)
ON CONFLICT (nit) DO NOTHING;
INSERT INTO PROVEEDOR (empresa, nit, nombre_contacto, telefono_contacto, correo_contacto, activo)
VALUES ('Confecciones Tunari Ltda.', '1013894028', 'Marcela Camacho Arce', '70739462', 'comercial@confeccionestunari.com.bo', true)
ON CONFLICT (nit) DO NOTHING;
INSERT INTO PROVEEDOR (empresa, nit, nombre_contacto, telefono_contacto, correo_contacto, activo)
VALUES ('Tejidos Illimani S.R.L.', '1020673024', 'Freddy Callisaya Nina', '72096834', 'ventas@tejidosillimani.com.bo', true)
ON CONFLICT (nit) DO NOTHING;
INSERT INTO PROVEEDOR (empresa, nit, nombre_contacto, telefono_contacto, correo_contacto, activo)
VALUES ('Camisería El Prado S.R.L.', '1029047021', 'Wilma Saucedo Ribera', '77358120', 'contacto@camiseriaelprado.com.bo', true)
ON CONFLICT (nit) DO NOTHING;
INSERT INTO PROVEEDOR (empresa, nit, nombre_contacto, telefono_contacto, correo_contacto, activo)
VALUES ('Importadora Pacífico Moda S.R.L.', '1017352026', 'Jorge Iriarte Beltrán', '69845217', 'importaciones@pacificomoda.com.bo', true)
ON CONFLICT (nit) DO NOTHING;
INSERT INTO PROVEEDOR (empresa, nit, nombre_contacto, telefono_contacto, correo_contacto, activo)
VALUES ('Modas del Oriente Ltda.', '1004819025', 'Nancy Parada Vaca', '78012645', 'ventas@modasdeloriente.com.bo', false)
ON CONFLICT (nit) DO NOTHING;

-- ===========================================================================
-- SUCURSALES NUEVAS Y SUS ALMACENES
-- ===========================================================================
INSERT INTO SUCURSAL (id_ciudad, nombre, telefono, correo, horario_apertura, horario_cierre, ubicacion, activo)
SELECT id, 'RVRStyle Sopocachi', '76432180', 'sopocachi@rvrstyle.com.bo', '09:00', '21:00', 'Av. 20 de Octubre #2315, Sopocachi', TRUE
FROM CIUDAD WHERE nombre = 'La Paz'
AND NOT EXISTS (SELECT 1 FROM SUCURSAL WHERE nombre = 'RVRStyle Sopocachi');

INSERT INTO ALMACEN (id_sucursal, nombre, ubicacion_fisica, activo)
SELECT id, 'Almacén Sopocachi', 'Planta baja, trastienda', TRUE
FROM SUCURSAL WHERE nombre = 'RVRStyle Sopocachi'
AND NOT EXISTS (SELECT 1 FROM ALMACEN WHERE nombre = 'Almacén Sopocachi');
INSERT INTO SUCURSAL (id_ciudad, nombre, telefono, correo, horario_apertura, horario_cierre, ubicacion, activo)
SELECT id, 'RVRStyle Cala Cala', '79015643', 'calacala@rvrstyle.com.bo', '09:00', '20:30', 'Av. América #456, Cala Cala', TRUE
FROM CIUDAD WHERE nombre = 'Cochabamba'
AND NOT EXISTS (SELECT 1 FROM SUCURSAL WHERE nombre = 'RVRStyle Cala Cala');

INSERT INTO ALMACEN (id_sucursal, nombre, ubicacion_fisica, activo)
SELECT id, 'Almacén Cala Cala', 'Primer piso, depósito trasero', TRUE
FROM SUCURSAL WHERE nombre = 'RVRStyle Cala Cala'
AND NOT EXISTS (SELECT 1 FROM ALMACEN WHERE nombre = 'Almacén Cala Cala');

-- ===========================================================================
-- TEMPORADAS (campanas comerciales nuevas; las 4 estaciones ya las siembra la app)
-- ===========================================================================
INSERT INTO TEMPORADA (nombre, fecha_inicio, fecha_fin, descripcion)
SELECT 'Día de la Madre 2026', '2026-05-15', '2026-05-27', 'Campaña de regalos: blusas, vestidos y enterizos con descuentos especiales.'
WHERE NOT EXISTS (SELECT 1 FROM TEMPORADA WHERE nombre = 'Día de la Madre 2026');
INSERT INTO TEMPORADA (nombre, fecha_inicio, fecha_fin, descripcion)
SELECT 'Black Friday 2026', '2026-11-20', '2026-11-30', 'Descuentos de fin de año en jeans, chaquetas, abrigos y básicos.'
WHERE NOT EXISTS (SELECT 1 FROM TEMPORADA WHERE nombre = 'Black Friday 2026');
INSERT INTO TEMPORADA (nombre, fecha_inicio, fecha_fin, descripcion)
SELECT 'Navidad 2026', '2026-12-01', '2026-12-25', 'Ropa de fiesta y prendas para regalar durante diciembre.'
WHERE NOT EXISTS (SELECT 1 FROM TEMPORADA WHERE nombre = 'Navidad 2026');

-- ===========================================================================
-- TEMPORADA_CATEGORIA (vincula cada temporada, nueva o de estacion, con sus categorias)
-- ===========================================================================
INSERT INTO TEMPORADA_CATEGORIA (id_temporada, id_categoria)
SELECT t.id, c.id FROM TEMPORADA t, CATEGORIA c
WHERE t.nombre = 'Otoño' AND c.slug = 'sueteres'
ON CONFLICT DO NOTHING;
INSERT INTO TEMPORADA_CATEGORIA (id_temporada, id_categoria)
SELECT t.id, c.id FROM TEMPORADA t, CATEGORIA c
WHERE t.nombre = 'Otoño' AND c.slug = 'chaquetas'
ON CONFLICT DO NOTHING;
INSERT INTO TEMPORADA_CATEGORIA (id_temporada, id_categoria)
SELECT t.id, c.id FROM TEMPORADA t, CATEGORIA c
WHERE t.nombre = 'Otoño' AND c.slug = 'camisas'
ON CONFLICT DO NOTHING;
INSERT INTO TEMPORADA_CATEGORIA (id_temporada, id_categoria)
SELECT t.id, c.id FROM TEMPORADA t, CATEGORIA c
WHERE t.nombre = 'Otoño' AND c.slug = 'jeans'
ON CONFLICT DO NOTHING;
INSERT INTO TEMPORADA_CATEGORIA (id_temporada, id_categoria)
SELECT t.id, c.id FROM TEMPORADA t, CATEGORIA c
WHERE t.nombre = 'Invierno' AND c.slug = 'abrigos'
ON CONFLICT DO NOTHING;
INSERT INTO TEMPORADA_CATEGORIA (id_temporada, id_categoria)
SELECT t.id, c.id FROM TEMPORADA t, CATEGORIA c
WHERE t.nombre = 'Invierno' AND c.slug = 'sueteres'
ON CONFLICT DO NOTHING;
INSERT INTO TEMPORADA_CATEGORIA (id_temporada, id_categoria)
SELECT t.id, c.id FROM TEMPORADA t, CATEGORIA c
WHERE t.nombre = 'Invierno' AND c.slug = 'chaquetas'
ON CONFLICT DO NOTHING;
INSERT INTO TEMPORADA_CATEGORIA (id_temporada, id_categoria)
SELECT t.id, c.id FROM TEMPORADA t, CATEGORIA c
WHERE t.nombre = 'Invierno' AND c.slug = 'jeans'
ON CONFLICT DO NOTHING;
INSERT INTO TEMPORADA_CATEGORIA (id_temporada, id_categoria)
SELECT t.id, c.id FROM TEMPORADA t, CATEGORIA c
WHERE t.nombre = 'Primavera' AND c.slug = 'blusas'
ON CONFLICT DO NOTHING;
INSERT INTO TEMPORADA_CATEGORIA (id_temporada, id_categoria)
SELECT t.id, c.id FROM TEMPORADA t, CATEGORIA c
WHERE t.nombre = 'Primavera' AND c.slug = 'vestidos'
ON CONFLICT DO NOTHING;
INSERT INTO TEMPORADA_CATEGORIA (id_temporada, id_categoria)
SELECT t.id, c.id FROM TEMPORADA t, CATEGORIA c
WHERE t.nombre = 'Primavera' AND c.slug = 'faldas'
ON CONFLICT DO NOTHING;
INSERT INTO TEMPORADA_CATEGORIA (id_temporada, id_categoria)
SELECT t.id, c.id FROM TEMPORADA t, CATEGORIA c
WHERE t.nombre = 'Primavera' AND c.slug = 'poleras'
ON CONFLICT DO NOTHING;
INSERT INTO TEMPORADA_CATEGORIA (id_temporada, id_categoria)
SELECT t.id, c.id FROM TEMPORADA t, CATEGORIA c
WHERE t.nombre = 'Primavera' AND c.slug = 'camisas'
ON CONFLICT DO NOTHING;
INSERT INTO TEMPORADA_CATEGORIA (id_temporada, id_categoria)
SELECT t.id, c.id FROM TEMPORADA t, CATEGORIA c
WHERE t.nombre = 'Verano' AND c.slug = 'shorts'
ON CONFLICT DO NOTHING;
INSERT INTO TEMPORADA_CATEGORIA (id_temporada, id_categoria)
SELECT t.id, c.id FROM TEMPORADA t, CATEGORIA c
WHERE t.nombre = 'Verano' AND c.slug = 'vestidos'
ON CONFLICT DO NOTHING;
INSERT INTO TEMPORADA_CATEGORIA (id_temporada, id_categoria)
SELECT t.id, c.id FROM TEMPORADA t, CATEGORIA c
WHERE t.nombre = 'Verano' AND c.slug = 'enterizos'
ON CONFLICT DO NOTHING;
INSERT INTO TEMPORADA_CATEGORIA (id_temporada, id_categoria)
SELECT t.id, c.id FROM TEMPORADA t, CATEGORIA c
WHERE t.nombre = 'Verano' AND c.slug = 'monos'
ON CONFLICT DO NOTHING;
INSERT INTO TEMPORADA_CATEGORIA (id_temporada, id_categoria)
SELECT t.id, c.id FROM TEMPORADA t, CATEGORIA c
WHERE t.nombre = 'Verano' AND c.slug = 'poleras'
ON CONFLICT DO NOTHING;
INSERT INTO TEMPORADA_CATEGORIA (id_temporada, id_categoria)
SELECT t.id, c.id FROM TEMPORADA t, CATEGORIA c
WHERE t.nombre = 'Verano' AND c.slug = 'blusas'
ON CONFLICT DO NOTHING;
INSERT INTO TEMPORADA_CATEGORIA (id_temporada, id_categoria)
SELECT t.id, c.id FROM TEMPORADA t, CATEGORIA c
WHERE t.nombre = 'Día de la Madre 2026' AND c.slug = 'blusas'
ON CONFLICT DO NOTHING;
INSERT INTO TEMPORADA_CATEGORIA (id_temporada, id_categoria)
SELECT t.id, c.id FROM TEMPORADA t, CATEGORIA c
WHERE t.nombre = 'Día de la Madre 2026' AND c.slug = 'vestidos'
ON CONFLICT DO NOTHING;
INSERT INTO TEMPORADA_CATEGORIA (id_temporada, id_categoria)
SELECT t.id, c.id FROM TEMPORADA t, CATEGORIA c
WHERE t.nombre = 'Día de la Madre 2026' AND c.slug = 'enterizos'
ON CONFLICT DO NOTHING;
INSERT INTO TEMPORADA_CATEGORIA (id_temporada, id_categoria)
SELECT t.id, c.id FROM TEMPORADA t, CATEGORIA c
WHERE t.nombre = 'Black Friday 2026' AND c.slug = 'jeans'
ON CONFLICT DO NOTHING;
INSERT INTO TEMPORADA_CATEGORIA (id_temporada, id_categoria)
SELECT t.id, c.id FROM TEMPORADA t, CATEGORIA c
WHERE t.nombre = 'Black Friday 2026' AND c.slug = 'chaquetas'
ON CONFLICT DO NOTHING;
INSERT INTO TEMPORADA_CATEGORIA (id_temporada, id_categoria)
SELECT t.id, c.id FROM TEMPORADA t, CATEGORIA c
WHERE t.nombre = 'Black Friday 2026' AND c.slug = 'abrigos'
ON CONFLICT DO NOTHING;
INSERT INTO TEMPORADA_CATEGORIA (id_temporada, id_categoria)
SELECT t.id, c.id FROM TEMPORADA t, CATEGORIA c
WHERE t.nombre = 'Black Friday 2026' AND c.slug = 'poleras'
ON CONFLICT DO NOTHING;
INSERT INTO TEMPORADA_CATEGORIA (id_temporada, id_categoria)
SELECT t.id, c.id FROM TEMPORADA t, CATEGORIA c
WHERE t.nombre = 'Navidad 2026' AND c.slug = 'vestidos'
ON CONFLICT DO NOTHING;
INSERT INTO TEMPORADA_CATEGORIA (id_temporada, id_categoria)
SELECT t.id, c.id FROM TEMPORADA t, CATEGORIA c
WHERE t.nombre = 'Navidad 2026' AND c.slug = 'monos'
ON CONFLICT DO NOTHING;
INSERT INTO TEMPORADA_CATEGORIA (id_temporada, id_categoria)
SELECT t.id, c.id FROM TEMPORADA t, CATEGORIA c
WHERE t.nombre = 'Navidad 2026' AND c.slug = 'camisas'
ON CONFLICT DO NOTHING;
INSERT INTO TEMPORADA_CATEGORIA (id_temporada, id_categoria)
SELECT t.id, c.id FROM TEMPORADA t, CATEGORIA c
WHERE t.nombre = 'Navidad 2026' AND c.slug = 'sueteres'
ON CONFLICT DO NOTHING;

-- ===========================================================================
-- EMPLEADOS (usuario + empleado + rol_usuario + empleado_sucursal)
-- ===========================================================================
INSERT INTO USUARIO (nombre, apellido, email, telefono, password_hash, sexo, tipo_usuario, estado_acceso)
SELECT 'María Fernanda', 'Suárez Justiniano', 'maria.suarez@rvrstyle.com.bo', '70412857', '$2b$10$pFN/bhQuTZWDjejkznyt8Ofx9BzPqsdD3enoxfbJCZ9ikN3pXpwtO', 'F', 'E', 'HABILITADO'
WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE email = 'maria.suarez@rvrstyle.com.bo');

INSERT INTO EMPLEADO (id_usuario, codigo_empleado, salario, fecha_contratacion)
SELECT id, 'EMP-' || LPAD(id::text, 4, '0'), 5200, '2025-03-10'
FROM USUARIO WHERE email = 'maria.suarez@rvrstyle.com.bo'
AND NOT EXISTS (SELECT 1 FROM EMPLEADO WHERE id_usuario = (SELECT id FROM USUARIO WHERE email = 'maria.suarez@rvrstyle.com.bo'));

INSERT INTO ROL_USUARIO (id_rol, id_usuario)
SELECT r.id, u.id FROM ROL r, USUARIO u WHERE r.nombre = 'ENCARGADO_SUCURSAL' AND u.email = 'maria.suarez@rvrstyle.com.bo'
ON CONFLICT DO NOTHING;

INSERT INTO EMPLEADO_SUCURSAL (id_empleado, id_sucursal)
SELECT u.id, s.id FROM USUARIO u, SUCURSAL s WHERE u.email = 'maria.suarez@rvrstyle.com.bo' AND s.nombre = 'RVRStyle'
ON CONFLICT DO NOTHING;
INSERT INTO USUARIO (nombre, apellido, email, telefono, password_hash, sexo, tipo_usuario, estado_acceso)
SELECT 'Luis Alberto', 'Cuéllar Roca', 'luis.cuellar@rvrstyle.com.bo', '77315902', '$2b$10$pFN/bhQuTZWDjejkznyt8Ofx9BzPqsdD3enoxfbJCZ9ikN3pXpwtO', 'M', 'E', 'HABILITADO'
WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE email = 'luis.cuellar@rvrstyle.com.bo');

INSERT INTO EMPLEADO (id_usuario, codigo_empleado, salario, fecha_contratacion)
SELECT id, 'EMP-' || LPAD(id::text, 4, '0'), 3300, '2025-06-02'
FROM USUARIO WHERE email = 'luis.cuellar@rvrstyle.com.bo'
AND NOT EXISTS (SELECT 1 FROM EMPLEADO WHERE id_usuario = (SELECT id FROM USUARIO WHERE email = 'luis.cuellar@rvrstyle.com.bo'));

INSERT INTO ROL_USUARIO (id_rol, id_usuario)
SELECT r.id, u.id FROM ROL r, USUARIO u WHERE r.nombre = 'VENDEDOR_CAJERO' AND u.email = 'luis.cuellar@rvrstyle.com.bo'
ON CONFLICT DO NOTHING;

INSERT INTO EMPLEADO_SUCURSAL (id_empleado, id_sucursal)
SELECT u.id, s.id FROM USUARIO u, SUCURSAL s WHERE u.email = 'luis.cuellar@rvrstyle.com.bo' AND s.nombre = 'RVRStyle'
ON CONFLICT DO NOTHING;
INSERT INTO USUARIO (nombre, apellido, email, telefono, password_hash, sexo, tipo_usuario, estado_acceso)
SELECT 'Daniela', 'Melgar Vaca', 'daniela.melgar@rvrstyle.com.bo', '69823471', '$2b$10$pFN/bhQuTZWDjejkznyt8Ofx9BzPqsdD3enoxfbJCZ9ikN3pXpwtO', 'F', 'E', 'HABILITADO'
WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE email = 'daniela.melgar@rvrstyle.com.bo');

INSERT INTO EMPLEADO (id_usuario, codigo_empleado, salario, fecha_contratacion)
SELECT id, 'EMP-' || LPAD(id::text, 4, '0'), 3300, '2025-11-17'
FROM USUARIO WHERE email = 'daniela.melgar@rvrstyle.com.bo'
AND NOT EXISTS (SELECT 1 FROM EMPLEADO WHERE id_usuario = (SELECT id FROM USUARIO WHERE email = 'daniela.melgar@rvrstyle.com.bo'));

INSERT INTO ROL_USUARIO (id_rol, id_usuario)
SELECT r.id, u.id FROM ROL r, USUARIO u WHERE r.nombre = 'VENDEDOR_CAJERO' AND u.email = 'daniela.melgar@rvrstyle.com.bo'
ON CONFLICT DO NOTHING;

INSERT INTO EMPLEADO_SUCURSAL (id_empleado, id_sucursal)
SELECT u.id, s.id FROM USUARIO u, SUCURSAL s WHERE u.email = 'daniela.melgar@rvrstyle.com.bo' AND s.nombre = 'RVRStyle'
ON CONFLICT DO NOTHING;
INSERT INTO USUARIO (nombre, apellido, email, telefono, password_hash, sexo, tipo_usuario, estado_acceso)
SELECT 'Carlos Eduardo', 'Añez Parada', 'carlos.anez@rvrstyle.com.bo', '71864023', '$2b$10$pFN/bhQuTZWDjejkznyt8Ofx9BzPqsdD3enoxfbJCZ9ikN3pXpwtO', 'M', 'E', 'HABILITADO'
WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE email = 'carlos.anez@rvrstyle.com.bo');

INSERT INTO EMPLEADO (id_usuario, codigo_empleado, salario, fecha_contratacion)
SELECT id, 'EMP-' || LPAD(id::text, 4, '0'), 3900, '2025-04-21'
FROM USUARIO WHERE email = 'carlos.anez@rvrstyle.com.bo'
AND NOT EXISTS (SELECT 1 FROM EMPLEADO WHERE id_usuario = (SELECT id FROM USUARIO WHERE email = 'carlos.anez@rvrstyle.com.bo'));

INSERT INTO ROL_USUARIO (id_rol, id_usuario)
SELECT r.id, u.id FROM ROL r, USUARIO u WHERE r.nombre = 'ENCARGADO_INVENTARIO' AND u.email = 'carlos.anez@rvrstyle.com.bo'
ON CONFLICT DO NOTHING;

INSERT INTO EMPLEADO_SUCURSAL (id_empleado, id_sucursal)
SELECT u.id, s.id FROM USUARIO u, SUCURSAL s WHERE u.email = 'carlos.anez@rvrstyle.com.bo' AND s.nombre = 'RVRStyle'
ON CONFLICT DO NOTHING;
INSERT INTO USUARIO (nombre, apellido, email, telefono, password_hash, sexo, tipo_usuario, estado_acceso)
SELECT 'Patricia Lorena', 'Zabala Egüez', 'patricia.zabala@rvrstyle.com.bo', '78250316', '$2b$10$pFN/bhQuTZWDjejkznyt8Ofx9BzPqsdD3enoxfbJCZ9ikN3pXpwtO', 'F', 'E', 'HABILITADO'
WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE email = 'patricia.zabala@rvrstyle.com.bo');

INSERT INTO EMPLEADO (id_usuario, codigo_empleado, salario, fecha_contratacion)
SELECT id, 'EMP-' || LPAD(id::text, 4, '0'), 4500, '2025-02-03'
FROM USUARIO WHERE email = 'patricia.zabala@rvrstyle.com.bo'
AND NOT EXISTS (SELECT 1 FROM EMPLEADO WHERE id_usuario = (SELECT id FROM USUARIO WHERE email = 'patricia.zabala@rvrstyle.com.bo'));

INSERT INTO ROL_USUARIO (id_rol, id_usuario)
SELECT r.id, u.id FROM ROL r, USUARIO u WHERE r.nombre = 'ENCARGADO_COMPRAS' AND u.email = 'patricia.zabala@rvrstyle.com.bo'
ON CONFLICT DO NOTHING;

INSERT INTO EMPLEADO_SUCURSAL (id_empleado, id_sucursal)
SELECT u.id, s.id FROM USUARIO u, SUCURSAL s WHERE u.email = 'patricia.zabala@rvrstyle.com.bo' AND s.nombre = 'RVRStyle'
ON CONFLICT DO NOTHING;
INSERT INTO USUARIO (nombre, apellido, email, telefono, password_hash, sexo, tipo_usuario, estado_acceso)
SELECT 'Jhonny Rolando', 'Mendoza Cruz', 'jhonny.mendoza@rvrstyle.com.bo', '72938465', '$2b$10$pFN/bhQuTZWDjejkznyt8Ofx9BzPqsdD3enoxfbJCZ9ikN3pXpwtO', 'M', 'E', 'HABILITADO'
WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE email = 'jhonny.mendoza@rvrstyle.com.bo');

INSERT INTO EMPLEADO (id_usuario, codigo_empleado, salario, fecha_contratacion)
SELECT id, 'EMP-' || LPAD(id::text, 4, '0'), 4600, '2025-08-11'
FROM USUARIO WHERE email = 'jhonny.mendoza@rvrstyle.com.bo'
AND NOT EXISTS (SELECT 1 FROM EMPLEADO WHERE id_usuario = (SELECT id FROM USUARIO WHERE email = 'jhonny.mendoza@rvrstyle.com.bo'));

INSERT INTO ROL_USUARIO (id_rol, id_usuario)
SELECT r.id, u.id FROM ROL r, USUARIO u WHERE r.nombre = 'ENCARGADO_SUCURSAL' AND u.email = 'jhonny.mendoza@rvrstyle.com.bo'
ON CONFLICT DO NOTHING;

INSERT INTO EMPLEADO_SUCURSAL (id_empleado, id_sucursal)
SELECT u.id, s.id FROM USUARIO u, SUCURSAL s WHERE u.email = 'jhonny.mendoza@rvrstyle.com.bo' AND s.nombre = 'RVRStyle Beni'
ON CONFLICT DO NOTHING;
INSERT INTO USUARIO (nombre, apellido, email, telefono, password_hash, sexo, tipo_usuario, estado_acceso)
SELECT 'Andrea', 'Camacho Salvatierra', 'andrea.camacho@rvrstyle.com.bo', '60734189', '$2b$10$pFN/bhQuTZWDjejkznyt8Ofx9BzPqsdD3enoxfbJCZ9ikN3pXpwtO', 'F', 'E', 'HABILITADO'
WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE email = 'andrea.camacho@rvrstyle.com.bo');

INSERT INTO EMPLEADO (id_usuario, codigo_empleado, salario, fecha_contratacion)
SELECT id, 'EMP-' || LPAD(id::text, 4, '0'), 3200, '2026-01-12'
FROM USUARIO WHERE email = 'andrea.camacho@rvrstyle.com.bo'
AND NOT EXISTS (SELECT 1 FROM EMPLEADO WHERE id_usuario = (SELECT id FROM USUARIO WHERE email = 'andrea.camacho@rvrstyle.com.bo'));

INSERT INTO ROL_USUARIO (id_rol, id_usuario)
SELECT r.id, u.id FROM ROL r, USUARIO u WHERE r.nombre = 'VENDEDOR_CAJERO' AND u.email = 'andrea.camacho@rvrstyle.com.bo'
ON CONFLICT DO NOTHING;

INSERT INTO EMPLEADO_SUCURSAL (id_empleado, id_sucursal)
SELECT u.id, s.id FROM USUARIO u, SUCURSAL s WHERE u.email = 'andrea.camacho@rvrstyle.com.bo' AND s.nombre = 'RVRStyle Beni'
ON CONFLICT DO NOTHING;
INSERT INTO USUARIO (nombre, apellido, email, telefono, password_hash, sexo, tipo_usuario, estado_acceso)
SELECT 'Verónica', 'Alanoca Mamani', 'veronica.alanoca@rvrstyle.com.bo', '76045218', '$2b$10$pFN/bhQuTZWDjejkznyt8Ofx9BzPqsdD3enoxfbJCZ9ikN3pXpwtO', 'F', 'E', 'HABILITADO'
WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE email = 'veronica.alanoca@rvrstyle.com.bo');

INSERT INTO EMPLEADO (id_usuario, codigo_empleado, salario, fecha_contratacion)
SELECT id, 'EMP-' || LPAD(id::text, 4, '0'), 5000, '2025-09-01'
FROM USUARIO WHERE email = 'veronica.alanoca@rvrstyle.com.bo'
AND NOT EXISTS (SELECT 1 FROM EMPLEADO WHERE id_usuario = (SELECT id FROM USUARIO WHERE email = 'veronica.alanoca@rvrstyle.com.bo'));

INSERT INTO ROL_USUARIO (id_rol, id_usuario)
SELECT r.id, u.id FROM ROL r, USUARIO u WHERE r.nombre = 'ENCARGADO_SUCURSAL' AND u.email = 'veronica.alanoca@rvrstyle.com.bo'
ON CONFLICT DO NOTHING;

INSERT INTO EMPLEADO_SUCURSAL (id_empleado, id_sucursal)
SELECT u.id, s.id FROM USUARIO u, SUCURSAL s WHERE u.email = 'veronica.alanoca@rvrstyle.com.bo' AND s.nombre = 'RVRStyle Sopocachi'
ON CONFLICT DO NOTHING;
INSERT INTO USUARIO (nombre, apellido, email, telefono, password_hash, sexo, tipo_usuario, estado_acceso)
SELECT 'Rodrigo', 'Nina Callisaya', 'rodrigo.nina@rvrstyle.com.bo', '71582964', '$2b$10$pFN/bhQuTZWDjejkznyt8Ofx9BzPqsdD3enoxfbJCZ9ikN3pXpwtO', 'M', 'E', 'HABILITADO'
WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE email = 'rodrigo.nina@rvrstyle.com.bo');

INSERT INTO EMPLEADO (id_usuario, codigo_empleado, salario, fecha_contratacion)
SELECT id, 'EMP-' || LPAD(id::text, 4, '0'), 3300, '2025-10-06'
FROM USUARIO WHERE email = 'rodrigo.nina@rvrstyle.com.bo'
AND NOT EXISTS (SELECT 1 FROM EMPLEADO WHERE id_usuario = (SELECT id FROM USUARIO WHERE email = 'rodrigo.nina@rvrstyle.com.bo'));

INSERT INTO ROL_USUARIO (id_rol, id_usuario)
SELECT r.id, u.id FROM ROL r, USUARIO u WHERE r.nombre = 'VENDEDOR_CAJERO' AND u.email = 'rodrigo.nina@rvrstyle.com.bo'
ON CONFLICT DO NOTHING;

INSERT INTO EMPLEADO_SUCURSAL (id_empleado, id_sucursal)
SELECT u.id, s.id FROM USUARIO u, SUCURSAL s WHERE u.email = 'rodrigo.nina@rvrstyle.com.bo' AND s.nombre = 'RVRStyle Sopocachi'
ON CONFLICT DO NOTHING;
INSERT INTO USUARIO (nombre, apellido, email, telefono, password_hash, sexo, tipo_usuario, estado_acceso)
SELECT 'Sandra', 'Choque Villca', 'sandra.choque@rvrstyle.com.bo', '67420835', '$2b$10$pFN/bhQuTZWDjejkznyt8Ofx9BzPqsdD3enoxfbJCZ9ikN3pXpwtO', 'F', 'E', 'HABILITADO'
WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE email = 'sandra.choque@rvrstyle.com.bo');

INSERT INTO EMPLEADO (id_usuario, codigo_empleado, salario, fecha_contratacion)
SELECT id, 'EMP-' || LPAD(id::text, 4, '0'), 3300, '2026-02-16'
FROM USUARIO WHERE email = 'sandra.choque@rvrstyle.com.bo'
AND NOT EXISTS (SELECT 1 FROM EMPLEADO WHERE id_usuario = (SELECT id FROM USUARIO WHERE email = 'sandra.choque@rvrstyle.com.bo'));

INSERT INTO ROL_USUARIO (id_rol, id_usuario)
SELECT r.id, u.id FROM ROL r, USUARIO u WHERE r.nombre = 'VENDEDOR_CAJERO' AND u.email = 'sandra.choque@rvrstyle.com.bo'
ON CONFLICT DO NOTHING;

INSERT INTO EMPLEADO_SUCURSAL (id_empleado, id_sucursal)
SELECT u.id, s.id FROM USUARIO u, SUCURSAL s WHERE u.email = 'sandra.choque@rvrstyle.com.bo' AND s.nombre = 'RVRStyle Sopocachi'
ON CONFLICT DO NOTHING;
INSERT INTO USUARIO (nombre, apellido, email, telefono, password_hash, sexo, tipo_usuario, estado_acceso)
SELECT 'Gonzalo', 'Rocha Arce', 'gonzalo.rocha@rvrstyle.com.bo', '74196052', '$2b$10$pFN/bhQuTZWDjejkznyt8Ofx9BzPqsdD3enoxfbJCZ9ikN3pXpwtO', 'M', 'E', 'HABILITADO'
WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE email = 'gonzalo.rocha@rvrstyle.com.bo');

INSERT INTO EMPLEADO (id_usuario, codigo_empleado, salario, fecha_contratacion)
SELECT id, 'EMP-' || LPAD(id::text, 4, '0'), 4800, '2025-09-15'
FROM USUARIO WHERE email = 'gonzalo.rocha@rvrstyle.com.bo'
AND NOT EXISTS (SELECT 1 FROM EMPLEADO WHERE id_usuario = (SELECT id FROM USUARIO WHERE email = 'gonzalo.rocha@rvrstyle.com.bo'));

INSERT INTO ROL_USUARIO (id_rol, id_usuario)
SELECT r.id, u.id FROM ROL r, USUARIO u WHERE r.nombre = 'ENCARGADO_SUCURSAL' AND u.email = 'gonzalo.rocha@rvrstyle.com.bo'
ON CONFLICT DO NOTHING;

INSERT INTO EMPLEADO_SUCURSAL (id_empleado, id_sucursal)
SELECT u.id, s.id FROM USUARIO u, SUCURSAL s WHERE u.email = 'gonzalo.rocha@rvrstyle.com.bo' AND s.nombre = 'RVRStyle Cala Cala'
ON CONFLICT DO NOTHING;
INSERT INTO USUARIO (nombre, apellido, email, telefono, password_hash, sexo, tipo_usuario, estado_acceso)
SELECT 'Lizeth', 'Camacho Terrazas', 'lizeth.camacho@rvrstyle.com.bo', '79641308', '$2b$10$pFN/bhQuTZWDjejkznyt8Ofx9BzPqsdD3enoxfbJCZ9ikN3pXpwtO', 'F', 'E', 'HABILITADO'
WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE email = 'lizeth.camacho@rvrstyle.com.bo');

INSERT INTO EMPLEADO (id_usuario, codigo_empleado, salario, fecha_contratacion)
SELECT id, 'EMP-' || LPAD(id::text, 4, '0'), 3300, '2026-03-02'
FROM USUARIO WHERE email = 'lizeth.camacho@rvrstyle.com.bo'
AND NOT EXISTS (SELECT 1 FROM EMPLEADO WHERE id_usuario = (SELECT id FROM USUARIO WHERE email = 'lizeth.camacho@rvrstyle.com.bo'));

INSERT INTO ROL_USUARIO (id_rol, id_usuario)
SELECT r.id, u.id FROM ROL r, USUARIO u WHERE r.nombre = 'VENDEDOR_CAJERO' AND u.email = 'lizeth.camacho@rvrstyle.com.bo'
ON CONFLICT DO NOTHING;

INSERT INTO EMPLEADO_SUCURSAL (id_empleado, id_sucursal)
SELECT u.id, s.id FROM USUARIO u, SUCURSAL s WHERE u.email = 'lizeth.camacho@rvrstyle.com.bo' AND s.nombre = 'RVRStyle Cala Cala'
ON CONFLICT DO NOTHING;

-- ===========================================================================
-- CLIENTES (usuario + cliente)
-- ===========================================================================
INSERT INTO USUARIO (nombre, apellido, email, telefono, password_hash, sexo, tipo_usuario, estado_acceso)
SELECT 'Camila Andrea', 'Rojas Vaca', 'camila.rojas@gmail.com', '77410295', '$2b$10$pFN/bhQuTZWDjejkznyt8Ofx9BzPqsdD3enoxfbJCZ9ikN3pXpwtO', 'F', 'C', 'HABILITADO'
WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE email = 'camila.rojas@gmail.com');

INSERT INTO CLIENTE (id_usuario, ciudad_residencia, direccion_principal, puntos_fidelidad)
SELECT id, 'Santa Cruz de la Sierra', 'Calle Los Pinos #145, Barrio Equipetrol', 107
FROM USUARIO WHERE email = 'camila.rojas@gmail.com'
AND NOT EXISTS (SELECT 1 FROM CLIENTE WHERE id_usuario = (SELECT id FROM USUARIO WHERE email = 'camila.rojas@gmail.com'));
INSERT INTO USUARIO (nombre, apellido, email, telefono, password_hash, sexo, tipo_usuario, estado_acceso)
SELECT 'Valeria', 'Soleto Justiniano', 'valeria.soleto@hotmail.com', '70385642', '$2b$10$pFN/bhQuTZWDjejkznyt8Ofx9BzPqsdD3enoxfbJCZ9ikN3pXpwtO', 'F', 'C', 'HABILITADO'
WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE email = 'valeria.soleto@hotmail.com');

INSERT INTO CLIENTE (id_usuario, ciudad_residencia, direccion_principal, puntos_fidelidad)
SELECT id, 'Santa Cruz de la Sierra', 'Av. Alemana, 3er Anillo #1270', 215
FROM USUARIO WHERE email = 'valeria.soleto@hotmail.com'
AND NOT EXISTS (SELECT 1 FROM CLIENTE WHERE id_usuario = (SELECT id FROM USUARIO WHERE email = 'valeria.soleto@hotmail.com'));
INSERT INTO USUARIO (nombre, apellido, email, telefono, password_hash, sexo, tipo_usuario, estado_acceso)
SELECT 'Sebastián', 'Roca Barba', 'sebastian.roca93@gmail.com', '76823047', '$2b$10$pFN/bhQuTZWDjejkznyt8Ofx9BzPqsdD3enoxfbJCZ9ikN3pXpwtO', 'M', 'C', 'HABILITADO'
WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE email = 'sebastian.roca93@gmail.com');

INSERT INTO CLIENTE (id_usuario, ciudad_residencia, direccion_principal, puntos_fidelidad)
SELECT id, 'Santa Cruz de la Sierra', 'Urb. Las Palmas, Calle 2 #34', 47
FROM USUARIO WHERE email = 'sebastian.roca93@gmail.com'
AND NOT EXISTS (SELECT 1 FROM CLIENTE WHERE id_usuario = (SELECT id FROM USUARIO WHERE email = 'sebastian.roca93@gmail.com'));
INSERT INTO USUARIO (nombre, apellido, email, telefono, password_hash, sexo, tipo_usuario, estado_acceso)
SELECT 'Mariana', 'Peña Egüez', 'mariana.pena@outlook.com', '69172530', '$2b$10$pFN/bhQuTZWDjejkznyt8Ofx9BzPqsdD3enoxfbJCZ9ikN3pXpwtO', 'F', 'C', 'HABILITADO'
WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE email = 'mariana.pena@outlook.com');

INSERT INTO CLIENTE (id_usuario, ciudad_residencia, direccion_principal, puntos_fidelidad)
SELECT id, 'Santa Cruz de la Sierra', 'Barrio Hamacas, Calle Ñuflo de Chávez #388', 224
FROM USUARIO WHERE email = 'mariana.pena@outlook.com'
AND NOT EXISTS (SELECT 1 FROM CLIENTE WHERE id_usuario = (SELECT id FROM USUARIO WHERE email = 'mariana.pena@outlook.com'));
INSERT INTO USUARIO (nombre, apellido, email, telefono, password_hash, sexo, tipo_usuario, estado_acceso)
SELECT 'Diego Alejandro', 'Suárez Cuéllar', 'diego.suarez@gmail.com', '72046918', '$2b$10$pFN/bhQuTZWDjejkznyt8Ofx9BzPqsdD3enoxfbJCZ9ikN3pXpwtO', 'M', 'C', 'HABILITADO'
WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE email = 'diego.suarez@gmail.com');

INSERT INTO CLIENTE (id_usuario, ciudad_residencia, direccion_principal, puntos_fidelidad)
SELECT id, 'Santa Cruz de la Sierra', 'Av. Beni, 2do Anillo #560', 99
FROM USUARIO WHERE email = 'diego.suarez@gmail.com'
AND NOT EXISTS (SELECT 1 FROM CLIENTE WHERE id_usuario = (SELECT id FROM USUARIO WHERE email = 'diego.suarez@gmail.com'));
INSERT INTO USUARIO (nombre, apellido, email, telefono, password_hash, sexo, tipo_usuario, estado_acceso)
SELECT 'Fabiola', 'Parada Melgar', 'fabiola.parada@gmail.com', '78539164', '$2b$10$pFN/bhQuTZWDjejkznyt8Ofx9BzPqsdD3enoxfbJCZ9ikN3pXpwtO', 'F', 'C', 'HABILITADO'
WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE email = 'fabiola.parada@gmail.com');

INSERT INTO CLIENTE (id_usuario, ciudad_residencia, direccion_principal, puntos_fidelidad)
SELECT id, 'Santa Cruz de la Sierra', 'Calle Charcas #412, Casco Viejo', 122
FROM USUARIO WHERE email = 'fabiola.parada@gmail.com'
AND NOT EXISTS (SELECT 1 FROM CLIENTE WHERE id_usuario = (SELECT id FROM USUARIO WHERE email = 'fabiola.parada@gmail.com'));
INSERT INTO USUARIO (nombre, apellido, email, telefono, password_hash, sexo, tipo_usuario, estado_acceso)
SELECT 'Andrés', 'Molina Chávez', 'andres.molina88@hotmail.com', '71296035', '$2b$10$pFN/bhQuTZWDjejkznyt8Ofx9BzPqsdD3enoxfbJCZ9ikN3pXpwtO', 'M', 'C', 'HABILITADO'
WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE email = 'andres.molina88@hotmail.com');

INSERT INTO CLIENTE (id_usuario, ciudad_residencia, direccion_principal, puntos_fidelidad)
SELECT id, 'Santa Cruz de la Sierra', 'Av. Santos Dumont, 4to Anillo #2205', 146
FROM USUARIO WHERE email = 'andres.molina88@hotmail.com'
AND NOT EXISTS (SELECT 1 FROM CLIENTE WHERE id_usuario = (SELECT id FROM USUARIO WHERE email = 'andres.molina88@hotmail.com'));
INSERT INTO USUARIO (nombre, apellido, email, telefono, password_hash, sexo, tipo_usuario, estado_acceso)
SELECT 'Karen Yesenia', 'Flores Ribera', 'karen.flores@gmail.com', '60418752', '$2b$10$pFN/bhQuTZWDjejkznyt8Ofx9BzPqsdD3enoxfbJCZ9ikN3pXpwtO', 'F', 'C', 'HABILITADO'
WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE email = 'karen.flores@gmail.com');

INSERT INTO CLIENTE (id_usuario, ciudad_residencia, direccion_principal, puntos_fidelidad)
SELECT id, 'Santa Cruz de la Sierra', 'Barrio Sirari, Calle Las Orquídeas #78', 175
FROM USUARIO WHERE email = 'karen.flores@gmail.com'
AND NOT EXISTS (SELECT 1 FROM CLIENTE WHERE id_usuario = (SELECT id FROM USUARIO WHERE email = 'karen.flores@gmail.com'));
INSERT INTO USUARIO (nombre, apellido, email, telefono, password_hash, sexo, tipo_usuario, estado_acceso)
SELECT 'Rocío', 'Antelo Saucedo', 'rocio.antelo@gmail.com', '77684023', '$2b$10$pFN/bhQuTZWDjejkznyt8Ofx9BzPqsdD3enoxfbJCZ9ikN3pXpwtO', 'F', 'C', 'HABILITADO'
WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE email = 'rocio.antelo@gmail.com');

INSERT INTO CLIENTE (id_usuario, ciudad_residencia, direccion_principal, puntos_fidelidad)
SELECT id, 'Santa Cruz de la Sierra', 'Urb. Cañoto, Calle Cochabamba #221', 50
FROM USUARIO WHERE email = 'rocio.antelo@gmail.com'
AND NOT EXISTS (SELECT 1 FROM CLIENTE WHERE id_usuario = (SELECT id FROM USUARIO WHERE email = 'rocio.antelo@gmail.com'));
INSERT INTO USUARIO (nombre, apellido, email, telefono, password_hash, sexo, tipo_usuario, estado_acceso)
SELECT 'Marco Antonio', 'Terrazas Añez', 'marco.terrazas@gmail.com', '75031846', '$2b$10$pFN/bhQuTZWDjejkznyt8Ofx9BzPqsdD3enoxfbJCZ9ikN3pXpwtO', 'M', 'C', 'HABILITADO'
WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE email = 'marco.terrazas@gmail.com');

INSERT INTO CLIENTE (id_usuario, ciudad_residencia, direccion_principal, puntos_fidelidad)
SELECT id, 'Santa Cruz de la Sierra', 'Av. Roque Aguilera, 3er Anillo #930', 0
FROM USUARIO WHERE email = 'marco.terrazas@gmail.com'
AND NOT EXISTS (SELECT 1 FROM CLIENTE WHERE id_usuario = (SELECT id FROM USUARIO WHERE email = 'marco.terrazas@gmail.com'));
INSERT INTO USUARIO (nombre, apellido, email, telefono, password_hash, sexo, tipo_usuario, estado_acceso)
SELECT 'Lucía', 'Fernández Mamani', 'lucia.fernandez@gmail.com', '71538294', '$2b$10$pFN/bhQuTZWDjejkznyt8Ofx9BzPqsdD3enoxfbJCZ9ikN3pXpwtO', 'F', 'C', 'HABILITADO'
WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE email = 'lucia.fernandez@gmail.com');

INSERT INTO CLIENTE (id_usuario, ciudad_residencia, direccion_principal, puntos_fidelidad)
SELECT id, 'La Paz', 'Calle Belisario Salinas #560, Sopocachi', 105
FROM USUARIO WHERE email = 'lucia.fernandez@gmail.com'
AND NOT EXISTS (SELECT 1 FROM CLIENTE WHERE id_usuario = (SELECT id FROM USUARIO WHERE email = 'lucia.fernandez@gmail.com'));
INSERT INTO USUARIO (nombre, apellido, email, telefono, password_hash, sexo, tipo_usuario, estado_acceso)
SELECT 'Alejandra', 'Copa Quispe', 'alejandra.copa@hotmail.com', '76290418', '$2b$10$pFN/bhQuTZWDjejkznyt8Ofx9BzPqsdD3enoxfbJCZ9ikN3pXpwtO', 'F', 'C', 'HABILITADO'
WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE email = 'alejandra.copa@hotmail.com');

INSERT INTO CLIENTE (id_usuario, ciudad_residencia, direccion_principal, puntos_fidelidad)
SELECT id, 'La Paz', 'Av. Ballivián #1150, Calacoto', 144
FROM USUARIO WHERE email = 'alejandra.copa@hotmail.com'
AND NOT EXISTS (SELECT 1 FROM CLIENTE WHERE id_usuario = (SELECT id FROM USUARIO WHERE email = 'alejandra.copa@hotmail.com'));
INSERT INTO USUARIO (nombre, apellido, email, telefono, password_hash, sexo, tipo_usuario, estado_acceso)
SELECT 'Miguel Ángel', 'Condori Huanca', 'miguel.condori@gmail.com', '68345127', '$2b$10$pFN/bhQuTZWDjejkznyt8Ofx9BzPqsdD3enoxfbJCZ9ikN3pXpwtO', 'M', 'C', 'HABILITADO'
WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE email = 'miguel.condori@gmail.com');

INSERT INTO CLIENTE (id_usuario, ciudad_residencia, direccion_principal, puntos_fidelidad)
SELECT id, 'La Paz', 'Av. Arce #2431, San Jorge', 84
FROM USUARIO WHERE email = 'miguel.condori@gmail.com'
AND NOT EXISTS (SELECT 1 FROM CLIENTE WHERE id_usuario = (SELECT id FROM USUARIO WHERE email = 'miguel.condori@gmail.com'));
INSERT INTO USUARIO (nombre, apellido, email, telefono, password_hash, sexo, tipo_usuario, estado_acceso)
SELECT 'Noelia', 'Apaza Mendoza', 'noelia.apaza@outlook.com', '72814650', '$2b$10$pFN/bhQuTZWDjejkznyt8Ofx9BzPqsdD3enoxfbJCZ9ikN3pXpwtO', 'F', 'C', 'HABILITADO'
WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE email = 'noelia.apaza@outlook.com');

INSERT INTO CLIENTE (id_usuario, ciudad_residencia, direccion_principal, puntos_fidelidad)
SELECT id, 'La Paz', 'Calle Jaimes Freyre #2310, Sopocachi', 118
FROM USUARIO WHERE email = 'noelia.apaza@outlook.com'
AND NOT EXISTS (SELECT 1 FROM CLIENTE WHERE id_usuario = (SELECT id FROM USUARIO WHERE email = 'noelia.apaza@outlook.com'));
INSERT INTO USUARIO (nombre, apellido, email, telefono, password_hash, sexo, tipo_usuario, estado_acceso)
SELECT 'Fernando', 'Limachi Ticona', 'fernando.limachi@gmail.com', '73920586', '$2b$10$pFN/bhQuTZWDjejkznyt8Ofx9BzPqsdD3enoxfbJCZ9ikN3pXpwtO', 'M', 'C', 'HABILITADO'
WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE email = 'fernando.limachi@gmail.com');

INSERT INTO CLIENTE (id_usuario, ciudad_residencia, direccion_principal, puntos_fidelidad)
SELECT id, 'La Paz', 'Av. Busch #1042, Miraflores', 171
FROM USUARIO WHERE email = 'fernando.limachi@gmail.com'
AND NOT EXISTS (SELECT 1 FROM CLIENTE WHERE id_usuario = (SELECT id FROM USUARIO WHERE email = 'fernando.limachi@gmail.com'));
INSERT INTO USUARIO (nombre, apellido, email, telefono, password_hash, sexo, tipo_usuario, estado_acceso)
SELECT 'Jimena', 'Carvajal Ortuño', 'jimena.carvajal@gmail.com', '77015382', '$2b$10$pFN/bhQuTZWDjejkznyt8Ofx9BzPqsdD3enoxfbJCZ9ikN3pXpwtO', 'F', 'C', 'HABILITADO'
WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE email = 'jimena.carvajal@gmail.com');

INSERT INTO CLIENTE (id_usuario, ciudad_residencia, direccion_principal, puntos_fidelidad)
SELECT id, 'La Paz', 'Calle 21 #8320, Calacoto', 0
FROM USUARIO WHERE email = 'jimena.carvajal@gmail.com'
AND NOT EXISTS (SELECT 1 FROM CLIENTE WHERE id_usuario = (SELECT id FROM USUARIO WHERE email = 'jimena.carvajal@gmail.com'));
INSERT INTO USUARIO (nombre, apellido, email, telefono, password_hash, sexo, tipo_usuario, estado_acceso)
SELECT 'Adriana', 'Villarroel Camacho', 'adriana.villarroel@gmail.com', '70563917', '$2b$10$pFN/bhQuTZWDjejkznyt8Ofx9BzPqsdD3enoxfbJCZ9ikN3pXpwtO', 'F', 'C', 'HABILITADO'
WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE email = 'adriana.villarroel@gmail.com');

INSERT INTO CLIENTE (id_usuario, ciudad_residencia, direccion_principal, puntos_fidelidad)
SELECT id, 'Cochabamba', 'Av. Pando #1024, Cala Cala', 43
FROM USUARIO WHERE email = 'adriana.villarroel@gmail.com'
AND NOT EXISTS (SELECT 1 FROM CLIENTE WHERE id_usuario = (SELECT id FROM USUARIO WHERE email = 'adriana.villarroel@gmail.com'));
INSERT INTO USUARIO (nombre, apellido, email, telefono, password_hash, sexo, tipo_usuario, estado_acceso)
SELECT 'Juan Pablo', 'Arce Rocha', 'juan.arce@hotmail.com', '64827195', '$2b$10$pFN/bhQuTZWDjejkznyt8Ofx9BzPqsdD3enoxfbJCZ9ikN3pXpwtO', 'M', 'C', 'HABILITADO'
WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE email = 'juan.arce@hotmail.com');

INSERT INTO CLIENTE (id_usuario, ciudad_residencia, direccion_principal, puntos_fidelidad)
SELECT id, 'Cochabamba', 'Calle Antezana #457, Zona Central', 245
FROM USUARIO WHERE email = 'juan.arce@hotmail.com'
AND NOT EXISTS (SELECT 1 FROM CLIENTE WHERE id_usuario = (SELECT id FROM USUARIO WHERE email = 'juan.arce@hotmail.com'));
INSERT INTO USUARIO (nombre, apellido, email, telefono, password_hash, sexo, tipo_usuario, estado_acceso)
SELECT 'Tatiana', 'Gutiérrez Prado', 'tatiana.gutierrez@gmail.com', '78402653', '$2b$10$pFN/bhQuTZWDjejkznyt8Ofx9BzPqsdD3enoxfbJCZ9ikN3pXpwtO', 'F', 'C', 'HABILITADO'
WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE email = 'tatiana.gutierrez@gmail.com');

INSERT INTO CLIENTE (id_usuario, ciudad_residencia, direccion_principal, puntos_fidelidad)
SELECT id, 'Cochabamba', 'Av. Ramón Rivero #390, Cala Cala', 156
FROM USUARIO WHERE email = 'tatiana.gutierrez@gmail.com'
AND NOT EXISTS (SELECT 1 FROM CLIENTE WHERE id_usuario = (SELECT id FROM USUARIO WHERE email = 'tatiana.gutierrez@gmail.com'));
INSERT INTO USUARIO (nombre, apellido, email, telefono, password_hash, sexo, tipo_usuario, estado_acceso)
SELECT 'Ricardo', 'Salazar Vargas', 'ricardo.salazar@gmail.com', '71749380', '$2b$10$pFN/bhQuTZWDjejkznyt8Ofx9BzPqsdD3enoxfbJCZ9ikN3pXpwtO', 'M', 'C', 'BLOQUEADO'
WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE email = 'ricardo.salazar@gmail.com');

INSERT INTO CLIENTE (id_usuario, ciudad_residencia, direccion_principal, puntos_fidelidad)
SELECT id, 'Cochabamba', 'Calle Lanza #822', 113
FROM USUARIO WHERE email = 'ricardo.salazar@gmail.com'
AND NOT EXISTS (SELECT 1 FROM CLIENTE WHERE id_usuario = (SELECT id FROM USUARIO WHERE email = 'ricardo.salazar@gmail.com'));
INSERT INTO USUARIO (nombre, apellido, email, telefono, password_hash, sexo, tipo_usuario, estado_acceso)
SELECT 'Melissa', 'Choque Rivera', 'melissa.choque@outlook.com', '76158204', '$2b$10$pFN/bhQuTZWDjejkznyt8Ofx9BzPqsdD3enoxfbJCZ9ikN3pXpwtO', 'F', 'C', 'HABILITADO'
WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE email = 'melissa.choque@outlook.com');

INSERT INTO CLIENTE (id_usuario, ciudad_residencia, direccion_principal, puntos_fidelidad)
SELECT id, 'Cochabamba', 'Av. América #765, Zona Norte', 0
FROM USUARIO WHERE email = 'melissa.choque@outlook.com'
AND NOT EXISTS (SELECT 1 FROM CLIENTE WHERE id_usuario = (SELECT id FROM USUARIO WHERE email = 'melissa.choque@outlook.com'));
INSERT INTO USUARIO (nombre, apellido, email, telefono, password_hash, sexo, tipo_usuario, estado_acceso)
SELECT 'Paola Andrea', 'Estrada Beltrán', 'paola.estrada@gmail.com', '72360849', '$2b$10$pFN/bhQuTZWDjejkznyt8Ofx9BzPqsdD3enoxfbJCZ9ikN3pXpwtO', 'F', 'C', 'HABILITADO'
WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE email = 'paola.estrada@gmail.com');

INSERT INTO CLIENTE (id_usuario, ciudad_residencia, direccion_principal, puntos_fidelidad)
SELECT id, 'Sucre', 'Calle Ravelo #215', 130
FROM USUARIO WHERE email = 'paola.estrada@gmail.com'
AND NOT EXISTS (SELECT 1 FROM CLIENTE WHERE id_usuario = (SELECT id FROM USUARIO WHERE email = 'paola.estrada@gmail.com'));
INSERT INTO USUARIO (nombre, apellido, email, telefono, password_hash, sexo, tipo_usuario, estado_acceso)
SELECT 'Daniel', 'Cortez Baldivieso', 'daniel.cortez@gmail.com', '68105732', '$2b$10$pFN/bhQuTZWDjejkznyt8Ofx9BzPqsdD3enoxfbJCZ9ikN3pXpwtO', 'M', 'C', 'HABILITADO'
WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE email = 'daniel.cortez@gmail.com');

INSERT INTO CLIENTE (id_usuario, ciudad_residencia, direccion_principal, puntos_fidelidad)
SELECT id, 'Sucre', 'Av. Hernando Siles #1180', 89
FROM USUARIO WHERE email = 'daniel.cortez@gmail.com'
AND NOT EXISTS (SELECT 1 FROM CLIENTE WHERE id_usuario = (SELECT id FROM USUARIO WHERE email = 'daniel.cortez@gmail.com'));
INSERT INTO USUARIO (nombre, apellido, email, telefono, password_hash, sexo, tipo_usuario, estado_acceso)
SELECT 'Gabriela', 'Arancibia Torrico', 'gabriela.arancibia@hotmail.com', '75492016', '$2b$10$pFN/bhQuTZWDjejkznyt8Ofx9BzPqsdD3enoxfbJCZ9ikN3pXpwtO', 'F', 'C', 'HABILITADO'
WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE email = 'gabriela.arancibia@hotmail.com');

INSERT INTO CLIENTE (id_usuario, ciudad_residencia, direccion_principal, puntos_fidelidad)
SELECT id, 'Tarija', 'Calle Bolívar #630, Zona Central', 214
FROM USUARIO WHERE email = 'gabriela.arancibia@hotmail.com'
AND NOT EXISTS (SELECT 1 FROM CLIENTE WHERE id_usuario = (SELECT id FROM USUARIO WHERE email = 'gabriela.arancibia@hotmail.com'));

-- ===========================================================================
-- CATALOGO: PRODUCTO + VARIANTE_PRODUCTO + PRODUCTO_SUCURSAL + IMAGEN_PRODUCTO + INVENTARIO
-- ===========================================================================

-- POL01: Polera Básica Algodón Pima
INSERT INTO PRODUCTO (id_categoria, nombre, descripcion, precio, descuento_porcentaje)
SELECT id, 'Polera Básica Algodón Pima', 'Polera de algodón Pima 100% con cuello redondo. Tela suave y resistente que mantiene la forma después de varios lavados.', 75, 0
FROM CATEGORIA WHERE slug = 'poleras'
AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE nombre = 'Polera Básica Algodón Pima');
INSERT INTO VARIANTE_PRODUCTO (id_producto, sku, talla, color, corte)
SELECT pr.id, x.sku, x.talla, x.color, 'Regular'
FROM PRODUCTO pr, (VALUES
  ('POL01-BLA-S', 'S', 'Blanca'),
  ('POL01-BLA-M', 'M', 'Blanca'),
  ('POL01-NEG-S', 'S', 'Negra'),
  ('POL01-NEG-M', 'M', 'Negra'),
  ('POL01-GRJ-S', 'S', 'Gris Jaspe'),
  ('POL01-GRJ-M', 'M', 'Gris Jaspe')
) AS x(sku, talla, color)
WHERE pr.nombre = 'Polera Básica Algodón Pima'
AND NOT EXISTS (SELECT 1 FROM VARIANTE_PRODUCTO WHERE sku = x.sku);
INSERT INTO IMAGEN_PRODUCTO (id_producto, url, es_principal, orden)
SELECT id, 'https://picsum.photos/seed/POL01/640/800', TRUE, 1
FROM PRODUCTO WHERE nombre = 'Polera Básica Algodón Pima'
AND NOT EXISTS (SELECT 1 FROM IMAGEN_PRODUCTO WHERE id_producto = (SELECT id FROM PRODUCTO WHERE nombre = 'Polera Básica Algodón Pima'));
INSERT INTO PRODUCTO_SUCURSAL (id_producto, id_sucursal)
SELECT pr.id, s.id FROM PRODUCTO pr, SUCURSAL s
WHERE pr.nombre = 'Polera Básica Algodón Pima' AND s.nombre IN ('RVRStyle', 'RVRStyle Beni', 'RVRStyle Sopocachi', 'RVRStyle Cala Cala')
ON CONFLICT DO NOTHING;
INSERT INTO INVENTARIO (id_almacen, id_variante_producto, stock_disponible)
SELECT a.id, v.id, 29
FROM VARIANTE_PRODUCTO v, ALMACEN a
WHERE v.sku IN ('POL01-BLA-S', 'POL01-BLA-M', 'POL01-NEG-S', 'POL01-NEG-M', 'POL01-GRJ-S', 'POL01-GRJ-M')
AND a.nombre IN ('Alma001', 'Alma001-S2', 'Almacén Sopocachi', 'Almacén Cala Cala')
ON CONFLICT (id_almacen, id_variante_producto) DO NOTHING;

-- POL02: Polera Oversize Estampada Urban
INSERT INTO PRODUCTO (id_categoria, nombre, descripcion, precio, descuento_porcentaje)
SELECT id, 'Polera Oversize Estampada Urban', 'Polera de corte oversize con estampado frontal en serigrafía. Algodón grueso de 220 g/m² para un caimiento holgado.', 95, 15
FROM CATEGORIA WHERE slug = 'poleras'
AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE nombre = 'Polera Oversize Estampada Urban');
INSERT INTO VARIANTE_PRODUCTO (id_producto, sku, talla, color, corte)
SELECT pr.id, x.sku, x.talla, x.color, 'Oversize'
FROM PRODUCTO pr, (VALUES
  ('POL02-NEG-S', 'S', 'Negra'),
  ('POL02-NEG-M', 'M', 'Negra'),
  ('POL02-CRE-S', 'S', 'Crema'),
  ('POL02-CRE-M', 'M', 'Crema')
) AS x(sku, talla, color)
WHERE pr.nombre = 'Polera Oversize Estampada Urban'
AND NOT EXISTS (SELECT 1 FROM VARIANTE_PRODUCTO WHERE sku = x.sku);
INSERT INTO IMAGEN_PRODUCTO (id_producto, url, es_principal, orden)
SELECT id, 'https://picsum.photos/seed/POL02/640/800', TRUE, 1
FROM PRODUCTO WHERE nombre = 'Polera Oversize Estampada Urban'
AND NOT EXISTS (SELECT 1 FROM IMAGEN_PRODUCTO WHERE id_producto = (SELECT id FROM PRODUCTO WHERE nombre = 'Polera Oversize Estampada Urban'));
INSERT INTO PRODUCTO_SUCURSAL (id_producto, id_sucursal)
SELECT pr.id, s.id FROM PRODUCTO pr, SUCURSAL s
WHERE pr.nombre = 'Polera Oversize Estampada Urban' AND s.nombre IN ('RVRStyle', 'RVRStyle Beni', 'RVRStyle Sopocachi', 'RVRStyle Cala Cala')
ON CONFLICT DO NOTHING;
INSERT INTO INVENTARIO (id_almacen, id_variante_producto, stock_disponible)
SELECT a.id, v.id, 22
FROM VARIANTE_PRODUCTO v, ALMACEN a
WHERE v.sku IN ('POL02-NEG-S', 'POL02-NEG-M', 'POL02-CRE-S', 'POL02-CRE-M')
AND a.nombre IN ('Alma001', 'Alma001-S2', 'Almacén Sopocachi', 'Almacén Cala Cala')
ON CONFLICT (id_almacen, id_variante_producto) DO NOTHING;

-- POL03: Polera Cropped Acanalada
INSERT INTO PRODUCTO (id_categoria, nombre, descripcion, precio, descuento_porcentaje)
SELECT id, 'Polera Cropped Acanalada', 'Polera corta de tejido acanalado elástico, ajustada al cuerpo. Combina con jeans de tiro alto y faldas.', 65, 0
FROM CATEGORIA WHERE slug = 'poleras'
AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE nombre = 'Polera Cropped Acanalada');
INSERT INTO VARIANTE_PRODUCTO (id_producto, sku, talla, color, corte)
SELECT pr.id, x.sku, x.talla, x.color, 'Cropped'
FROM PRODUCTO pr, (VALUES
  ('POL03-BLA-S', 'S', 'Blanca'),
  ('POL03-BLA-M', 'M', 'Blanca'),
  ('POL03-ROS-S', 'S', 'Rosada'),
  ('POL03-ROS-M', 'M', 'Rosada'),
  ('POL03-VOL-S', 'S', 'Verde Oliva'),
  ('POL03-VOL-M', 'M', 'Verde Oliva')
) AS x(sku, talla, color)
WHERE pr.nombre = 'Polera Cropped Acanalada'
AND NOT EXISTS (SELECT 1 FROM VARIANTE_PRODUCTO WHERE sku = x.sku);
INSERT INTO IMAGEN_PRODUCTO (id_producto, url, es_principal, orden)
SELECT id, 'https://picsum.photos/seed/POL03/640/800', TRUE, 1
FROM PRODUCTO WHERE nombre = 'Polera Cropped Acanalada'
AND NOT EXISTS (SELECT 1 FROM IMAGEN_PRODUCTO WHERE id_producto = (SELECT id FROM PRODUCTO WHERE nombre = 'Polera Cropped Acanalada'));
INSERT INTO PRODUCTO_SUCURSAL (id_producto, id_sucursal)
SELECT pr.id, s.id FROM PRODUCTO pr, SUCURSAL s
WHERE pr.nombre = 'Polera Cropped Acanalada' AND s.nombre IN ('RVRStyle', 'RVRStyle Beni', 'RVRStyle Sopocachi', 'RVRStyle Cala Cala')
ON CONFLICT DO NOTHING;
INSERT INTO INVENTARIO (id_almacen, id_variante_producto, stock_disponible)
SELECT a.id, v.id, 20
FROM VARIANTE_PRODUCTO v, ALMACEN a
WHERE v.sku IN ('POL03-BLA-S', 'POL03-BLA-M', 'POL03-ROS-S', 'POL03-ROS-M', 'POL03-VOL-S', 'POL03-VOL-M')
AND a.nombre IN ('Alma001', 'Alma001-S2', 'Almacén Sopocachi', 'Almacén Cala Cala')
ON CONFLICT (id_almacen, id_variante_producto) DO NOTHING;

-- BLU01: Blusa Satinada Manga Larga
INSERT INTO PRODUCTO (id_categoria, nombre, descripcion, precio, descuento_porcentaje)
SELECT id, 'Blusa Satinada Manga Larga', 'Blusa de satén fluido con botones frontales y puños abotonados. Ideal para la oficina o una salida de noche.', 140, 0
FROM CATEGORIA WHERE slug = 'blusas'
AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE nombre = 'Blusa Satinada Manga Larga');
INSERT INTO VARIANTE_PRODUCTO (id_producto, sku, talla, color, corte)
SELECT pr.id, x.sku, x.talla, x.color, 'Regular'
FROM PRODUCTO pr, (VALUES
  ('BLU01-CHA-S', 'S', 'Champagne'),
  ('BLU01-CHA-M', 'M', 'Champagne'),
  ('BLU01-VIN-S', 'S', 'Vino'),
  ('BLU01-VIN-M', 'M', 'Vino')
) AS x(sku, talla, color)
WHERE pr.nombre = 'Blusa Satinada Manga Larga'
AND NOT EXISTS (SELECT 1 FROM VARIANTE_PRODUCTO WHERE sku = x.sku);
INSERT INTO IMAGEN_PRODUCTO (id_producto, url, es_principal, orden)
SELECT id, 'https://picsum.photos/seed/BLU01/640/800', TRUE, 1
FROM PRODUCTO WHERE nombre = 'Blusa Satinada Manga Larga'
AND NOT EXISTS (SELECT 1 FROM IMAGEN_PRODUCTO WHERE id_producto = (SELECT id FROM PRODUCTO WHERE nombre = 'Blusa Satinada Manga Larga'));
INSERT INTO PRODUCTO_SUCURSAL (id_producto, id_sucursal)
SELECT pr.id, s.id FROM PRODUCTO pr, SUCURSAL s
WHERE pr.nombre = 'Blusa Satinada Manga Larga' AND s.nombre IN ('RVRStyle', 'RVRStyle Beni', 'RVRStyle Sopocachi', 'RVRStyle Cala Cala')
ON CONFLICT DO NOTHING;
INSERT INTO INVENTARIO (id_almacen, id_variante_producto, stock_disponible)
SELECT a.id, v.id, 18
FROM VARIANTE_PRODUCTO v, ALMACEN a
WHERE v.sku IN ('BLU01-CHA-S', 'BLU01-CHA-M', 'BLU01-VIN-S', 'BLU01-VIN-M')
AND a.nombre IN ('Alma001', 'Alma001-S2', 'Almacén Sopocachi', 'Almacén Cala Cala')
ON CONFLICT (id_almacen, id_variante_producto) DO NOTHING;

-- BLU02: Blusa Bordada Campesina
INSERT INTO PRODUCTO (id_categoria, nombre, descripcion, precio, descuento_porcentaje)
SELECT id, 'Blusa Bordada Campesina', 'Blusa de algodón con bordado floral en el escote y mangas abullonadas. Detalle artesanal con elástico en el cuello.', 165, 0
FROM CATEGORIA WHERE slug = 'blusas'
AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE nombre = 'Blusa Bordada Campesina');
INSERT INTO VARIANTE_PRODUCTO (id_producto, sku, talla, color, corte)
SELECT pr.id, x.sku, x.talla, x.color, 'Amplio'
FROM PRODUCTO pr, (VALUES
  ('BLU02-BLA-S', 'S', 'Blanca'),
  ('BLU02-BLA-M', 'M', 'Blanca'),
  ('BLU02-CEL-S', 'S', 'Celeste'),
  ('BLU02-CEL-M', 'M', 'Celeste')
) AS x(sku, talla, color)
WHERE pr.nombre = 'Blusa Bordada Campesina'
AND NOT EXISTS (SELECT 1 FROM VARIANTE_PRODUCTO WHERE sku = x.sku);
INSERT INTO IMAGEN_PRODUCTO (id_producto, url, es_principal, orden)
SELECT id, 'https://picsum.photos/seed/BLU02/640/800', TRUE, 1
FROM PRODUCTO WHERE nombre = 'Blusa Bordada Campesina'
AND NOT EXISTS (SELECT 1 FROM IMAGEN_PRODUCTO WHERE id_producto = (SELECT id FROM PRODUCTO WHERE nombre = 'Blusa Bordada Campesina'));
INSERT INTO PRODUCTO_SUCURSAL (id_producto, id_sucursal)
SELECT pr.id, s.id FROM PRODUCTO pr, SUCURSAL s
WHERE pr.nombre = 'Blusa Bordada Campesina' AND s.nombre IN ('RVRStyle', 'RVRStyle Beni', 'RVRStyle Sopocachi', 'RVRStyle Cala Cala')
ON CONFLICT DO NOTHING;
INSERT INTO INVENTARIO (id_almacen, id_variante_producto, stock_disponible)
SELECT a.id, v.id, 16
FROM VARIANTE_PRODUCTO v, ALMACEN a
WHERE v.sku IN ('BLU02-BLA-S', 'BLU02-BLA-M', 'BLU02-CEL-S', 'BLU02-CEL-M')
AND a.nombre IN ('Alma001', 'Alma001-S2', 'Almacén Sopocachi', 'Almacén Cala Cala')
ON CONFLICT (id_almacen, id_variante_producto) DO NOTHING;

-- BLU03: Blusa Cruzada de Gasa
INSERT INTO PRODUCTO (id_categoria, nombre, descripcion, precio, descuento_porcentaje)
SELECT id, 'Blusa Cruzada de Gasa', 'Blusa cruzada de gasa liviana con lazo en la cintura y forro interior en el busto.', 120, 10
FROM CATEGORIA WHERE slug = 'blusas'
AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE nombre = 'Blusa Cruzada de Gasa');
INSERT INTO VARIANTE_PRODUCTO (id_producto, sku, talla, color, corte)
SELECT pr.id, x.sku, x.talla, x.color, 'Entallado'
FROM PRODUCTO pr, (VALUES
  ('BLU03-NEG-S', 'S', 'Negra'),
  ('BLU03-NEG-M', 'M', 'Negra'),
  ('BLU03-PAL-S', 'S', 'Palo de Rosa'),
  ('BLU03-PAL-M', 'M', 'Palo de Rosa')
) AS x(sku, talla, color)
WHERE pr.nombre = 'Blusa Cruzada de Gasa'
AND NOT EXISTS (SELECT 1 FROM VARIANTE_PRODUCTO WHERE sku = x.sku);
INSERT INTO IMAGEN_PRODUCTO (id_producto, url, es_principal, orden)
SELECT id, 'https://picsum.photos/seed/BLU03/640/800', TRUE, 1
FROM PRODUCTO WHERE nombre = 'Blusa Cruzada de Gasa'
AND NOT EXISTS (SELECT 1 FROM IMAGEN_PRODUCTO WHERE id_producto = (SELECT id FROM PRODUCTO WHERE nombre = 'Blusa Cruzada de Gasa'));
INSERT INTO PRODUCTO_SUCURSAL (id_producto, id_sucursal)
SELECT pr.id, s.id FROM PRODUCTO pr, SUCURSAL s
WHERE pr.nombre = 'Blusa Cruzada de Gasa' AND s.nombre IN ('RVRStyle', 'RVRStyle Beni', 'RVRStyle Sopocachi', 'RVRStyle Cala Cala')
ON CONFLICT DO NOTHING;
INSERT INTO INVENTARIO (id_almacen, id_variante_producto, stock_disponible)
SELECT a.id, v.id, 16
FROM VARIANTE_PRODUCTO v, ALMACEN a
WHERE v.sku IN ('BLU03-NEG-S', 'BLU03-NEG-M', 'BLU03-PAL-S', 'BLU03-PAL-M')
AND a.nombre IN ('Alma001', 'Alma001-S2', 'Almacén Sopocachi', 'Almacén Cala Cala')
ON CONFLICT (id_almacen, id_variante_producto) DO NOTHING;

-- CAM01: Camisa Oxford Clásica
INSERT INTO PRODUCTO (id_categoria, nombre, descripcion, precio, descuento_porcentaje)
SELECT id, 'Camisa Oxford Clásica', 'Camisa Oxford de algodón con cuello button-down y bolsillo en el pecho. Una prenda básica para uso diario o formal.', 175, 0
FROM CATEGORIA WHERE slug = 'camisas'
AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE nombre = 'Camisa Oxford Clásica');
INSERT INTO VARIANTE_PRODUCTO (id_producto, sku, talla, color, corte)
SELECT pr.id, x.sku, x.talla, x.color, 'Regular'
FROM PRODUCTO pr, (VALUES
  ('CAM01-BLA-S', 'S', 'Blanca'),
  ('CAM01-BLA-M', 'M', 'Blanca'),
  ('CAM01-CEL-S', 'S', 'Celeste'),
  ('CAM01-CEL-M', 'M', 'Celeste')
) AS x(sku, talla, color)
WHERE pr.nombre = 'Camisa Oxford Clásica'
AND NOT EXISTS (SELECT 1 FROM VARIANTE_PRODUCTO WHERE sku = x.sku);
INSERT INTO IMAGEN_PRODUCTO (id_producto, url, es_principal, orden)
SELECT id, 'https://picsum.photos/seed/CAM01/640/800', TRUE, 1
FROM PRODUCTO WHERE nombre = 'Camisa Oxford Clásica'
AND NOT EXISTS (SELECT 1 FROM IMAGEN_PRODUCTO WHERE id_producto = (SELECT id FROM PRODUCTO WHERE nombre = 'Camisa Oxford Clásica'));
INSERT INTO PRODUCTO_SUCURSAL (id_producto, id_sucursal)
SELECT pr.id, s.id FROM PRODUCTO pr, SUCURSAL s
WHERE pr.nombre = 'Camisa Oxford Clásica' AND s.nombre IN ('RVRStyle', 'RVRStyle Beni', 'RVRStyle Sopocachi', 'RVRStyle Cala Cala')
ON CONFLICT DO NOTHING;
INSERT INTO INVENTARIO (id_almacen, id_variante_producto, stock_disponible)
SELECT a.id, v.id, 22
FROM VARIANTE_PRODUCTO v, ALMACEN a
WHERE v.sku IN ('CAM01-BLA-S', 'CAM01-BLA-M', 'CAM01-CEL-S', 'CAM01-CEL-M')
AND a.nombre IN ('Alma001', 'Alma001-S2', 'Almacén Sopocachi', 'Almacén Cala Cala')
ON CONFLICT (id_almacen, id_variante_producto) DO NOTHING;

-- CAM02: Camisa de Lino Manga Corta
INSERT INTO PRODUCTO (id_categoria, nombre, descripcion, precio, descuento_porcentaje)
SELECT id, 'Camisa de Lino Manga Corta', 'Camisa de lino y algodón con manga corta, ventilada y fresca para climas cálidos.', 160, 0
FROM CATEGORIA WHERE slug = 'camisas'
AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE nombre = 'Camisa de Lino Manga Corta');
INSERT INTO VARIANTE_PRODUCTO (id_producto, sku, talla, color, corte)
SELECT pr.id, x.sku, x.talla, x.color, 'Recto'
FROM PRODUCTO pr, (VALUES
  ('CAM02-BEI-S', 'S', 'Beige'),
  ('CAM02-BEI-M', 'M', 'Beige'),
  ('CAM02-BLA-S', 'S', 'Blanca'),
  ('CAM02-BLA-M', 'M', 'Blanca')
) AS x(sku, talla, color)
WHERE pr.nombre = 'Camisa de Lino Manga Corta'
AND NOT EXISTS (SELECT 1 FROM VARIANTE_PRODUCTO WHERE sku = x.sku);
INSERT INTO IMAGEN_PRODUCTO (id_producto, url, es_principal, orden)
SELECT id, 'https://picsum.photos/seed/CAM02/640/800', TRUE, 1
FROM PRODUCTO WHERE nombre = 'Camisa de Lino Manga Corta'
AND NOT EXISTS (SELECT 1 FROM IMAGEN_PRODUCTO WHERE id_producto = (SELECT id FROM PRODUCTO WHERE nombre = 'Camisa de Lino Manga Corta'));
INSERT INTO PRODUCTO_SUCURSAL (id_producto, id_sucursal)
SELECT pr.id, s.id FROM PRODUCTO pr, SUCURSAL s
WHERE pr.nombre = 'Camisa de Lino Manga Corta' AND s.nombre IN ('RVRStyle', 'RVRStyle Beni', 'RVRStyle Sopocachi', 'RVRStyle Cala Cala')
ON CONFLICT DO NOTHING;
INSERT INTO INVENTARIO (id_almacen, id_variante_producto, stock_disponible)
SELECT a.id, v.id, 18
FROM VARIANTE_PRODUCTO v, ALMACEN a
WHERE v.sku IN ('CAM02-BEI-S', 'CAM02-BEI-M', 'CAM02-BLA-S', 'CAM02-BLA-M')
AND a.nombre IN ('Alma001', 'Alma001-S2', 'Almacén Sopocachi', 'Almacén Cala Cala')
ON CONFLICT (id_almacen, id_variante_producto) DO NOTHING;

-- CAM03: Camisa Franela a Cuadros
INSERT INTO PRODUCTO (id_categoria, nombre, descripcion, precio, descuento_porcentaje)
SELECT id, 'Camisa Franela a Cuadros', 'Camisa de franela cepillada con estampado a cuadros. Cálida y suave, perfecta para el cambio de temporada.', 185, 20
FROM CATEGORIA WHERE slug = 'camisas'
AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE nombre = 'Camisa Franela a Cuadros');
INSERT INTO VARIANTE_PRODUCTO (id_producto, sku, talla, color, corte)
SELECT pr.id, x.sku, x.talla, x.color, 'Regular'
FROM PRODUCTO pr, (VALUES
  ('CAM03-CRJ-S', 'S', 'Cuadros Rojo'),
  ('CAM03-CRJ-M', 'M', 'Cuadros Rojo'),
  ('CAM03-CAZ-S', 'S', 'Cuadros Azul'),
  ('CAM03-CAZ-M', 'M', 'Cuadros Azul')
) AS x(sku, talla, color)
WHERE pr.nombre = 'Camisa Franela a Cuadros'
AND NOT EXISTS (SELECT 1 FROM VARIANTE_PRODUCTO WHERE sku = x.sku);
INSERT INTO IMAGEN_PRODUCTO (id_producto, url, es_principal, orden)
SELECT id, 'https://picsum.photos/seed/CAM03/640/800', TRUE, 1
FROM PRODUCTO WHERE nombre = 'Camisa Franela a Cuadros'
AND NOT EXISTS (SELECT 1 FROM IMAGEN_PRODUCTO WHERE id_producto = (SELECT id FROM PRODUCTO WHERE nombre = 'Camisa Franela a Cuadros'));
INSERT INTO PRODUCTO_SUCURSAL (id_producto, id_sucursal)
SELECT pr.id, s.id FROM PRODUCTO pr, SUCURSAL s
WHERE pr.nombre = 'Camisa Franela a Cuadros' AND s.nombre IN ('RVRStyle', 'RVRStyle Beni', 'RVRStyle Sopocachi', 'RVRStyle Cala Cala')
ON CONFLICT DO NOTHING;
INSERT INTO INVENTARIO (id_almacen, id_variante_producto, stock_disponible)
SELECT a.id, v.id, 14
FROM VARIANTE_PRODUCTO v, ALMACEN a
WHERE v.sku IN ('CAM03-CRJ-S', 'CAM03-CRJ-M', 'CAM03-CAZ-S', 'CAM03-CAZ-M')
AND a.nombre IN ('Alma001', 'Alma001-S2', 'Almacén Sopocachi', 'Almacén Cala Cala')
ON CONFLICT (id_almacen, id_variante_producto) DO NOTHING;

-- ABR01: Abrigo Largo de Paño
INSERT INTO PRODUCTO (id_categoria, nombre, descripcion, precio, descuento_porcentaje)
SELECT id, 'Abrigo Largo de Paño', 'Abrigo largo de paño con solapas amplias, botones al frente y bolsillos laterales. Forro interior satinado.', 520, 0
FROM CATEGORIA WHERE slug = 'abrigos'
AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE nombre = 'Abrigo Largo de Paño');
INSERT INTO VARIANTE_PRODUCTO (id_producto, sku, talla, color, corte)
SELECT pr.id, x.sku, x.talla, x.color, 'Recto'
FROM PRODUCTO pr, (VALUES
  ('ABR01-CAM-S', 'S', 'Camel'),
  ('ABR01-CAM-M', 'M', 'Camel'),
  ('ABR01-NEG-S', 'S', 'Negro'),
  ('ABR01-NEG-M', 'M', 'Negro')
) AS x(sku, talla, color)
WHERE pr.nombre = 'Abrigo Largo de Paño'
AND NOT EXISTS (SELECT 1 FROM VARIANTE_PRODUCTO WHERE sku = x.sku);
INSERT INTO IMAGEN_PRODUCTO (id_producto, url, es_principal, orden)
SELECT id, 'https://picsum.photos/seed/ABR01/640/800', TRUE, 1
FROM PRODUCTO WHERE nombre = 'Abrigo Largo de Paño'
AND NOT EXISTS (SELECT 1 FROM IMAGEN_PRODUCTO WHERE id_producto = (SELECT id FROM PRODUCTO WHERE nombre = 'Abrigo Largo de Paño'));
INSERT INTO PRODUCTO_SUCURSAL (id_producto, id_sucursal)
SELECT pr.id, s.id FROM PRODUCTO pr, SUCURSAL s
WHERE pr.nombre = 'Abrigo Largo de Paño' AND s.nombre IN ('RVRStyle', 'RVRStyle Sopocachi', 'RVRStyle Cala Cala')
ON CONFLICT DO NOTHING;
INSERT INTO INVENTARIO (id_almacen, id_variante_producto, stock_disponible)
SELECT a.id, v.id, 13
FROM VARIANTE_PRODUCTO v, ALMACEN a
WHERE v.sku IN ('ABR01-CAM-S', 'ABR01-CAM-M', 'ABR01-NEG-S', 'ABR01-NEG-M')
AND a.nombre IN ('Alma001', 'Almacén Sopocachi', 'Almacén Cala Cala')
ON CONFLICT (id_almacen, id_variante_producto) DO NOTHING;

-- ABR02: Abrigo Acolchado Puffer
INSERT INTO PRODUCTO (id_categoria, nombre, descripcion, precio, descuento_porcentaje)
SELECT id, 'Abrigo Acolchado Puffer', 'Abrigo acolchado con relleno sintético y capucha desmontable. Repelente al agua y muy liviano.', 480, 20
FROM CATEGORIA WHERE slug = 'abrigos'
AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE nombre = 'Abrigo Acolchado Puffer');
INSERT INTO VARIANTE_PRODUCTO (id_producto, sku, talla, color, corte)
SELECT pr.id, x.sku, x.talla, x.color, 'Oversize'
FROM PRODUCTO pr, (VALUES
  ('ABR02-NEG-S', 'S', 'Negro'),
  ('ABR02-NEG-M', 'M', 'Negro'),
  ('ABR02-VOL-S', 'S', 'Verde Oliva'),
  ('ABR02-VOL-M', 'M', 'Verde Oliva')
) AS x(sku, talla, color)
WHERE pr.nombre = 'Abrigo Acolchado Puffer'
AND NOT EXISTS (SELECT 1 FROM VARIANTE_PRODUCTO WHERE sku = x.sku);
INSERT INTO IMAGEN_PRODUCTO (id_producto, url, es_principal, orden)
SELECT id, 'https://picsum.photos/seed/ABR02/640/800', TRUE, 1
FROM PRODUCTO WHERE nombre = 'Abrigo Acolchado Puffer'
AND NOT EXISTS (SELECT 1 FROM IMAGEN_PRODUCTO WHERE id_producto = (SELECT id FROM PRODUCTO WHERE nombre = 'Abrigo Acolchado Puffer'));
INSERT INTO PRODUCTO_SUCURSAL (id_producto, id_sucursal)
SELECT pr.id, s.id FROM PRODUCTO pr, SUCURSAL s
WHERE pr.nombre = 'Abrigo Acolchado Puffer' AND s.nombre IN ('RVRStyle', 'RVRStyle Sopocachi')
ON CONFLICT DO NOTHING;
INSERT INTO INVENTARIO (id_almacen, id_variante_producto, stock_disponible)
SELECT a.id, v.id, 16
FROM VARIANTE_PRODUCTO v, ALMACEN a
WHERE v.sku IN ('ABR02-NEG-S', 'ABR02-NEG-M', 'ABR02-VOL-S', 'ABR02-VOL-M')
AND a.nombre IN ('Alma001', 'Almacén Sopocachi')
ON CONFLICT (id_almacen, id_variante_producto) DO NOTHING;

-- ABR03: Gabardina Clásica Trench
INSERT INTO PRODUCTO (id_categoria, nombre, descripcion, precio, descuento_porcentaje)
SELECT id, 'Gabardina Clásica Trench', 'Gabardina de algodón impermeable con cinturón y doble botonadura. Un clásico para la media estación.', 450, 0
FROM CATEGORIA WHERE slug = 'abrigos'
AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE nombre = 'Gabardina Clásica Trench');
INSERT INTO VARIANTE_PRODUCTO (id_producto, sku, talla, color, corte)
SELECT pr.id, x.sku, x.talla, x.color, 'Entallado'
FROM PRODUCTO pr, (VALUES
  ('ABR03-BEI-S', 'S', 'Beige'),
  ('ABR03-BEI-M', 'M', 'Beige'),
  ('ABR03-AZM-S', 'S', 'Azul Marino'),
  ('ABR03-AZM-M', 'M', 'Azul Marino')
) AS x(sku, talla, color)
WHERE pr.nombre = 'Gabardina Clásica Trench'
AND NOT EXISTS (SELECT 1 FROM VARIANTE_PRODUCTO WHERE sku = x.sku);
INSERT INTO IMAGEN_PRODUCTO (id_producto, url, es_principal, orden)
SELECT id, 'https://picsum.photos/seed/ABR03/640/800', TRUE, 1
FROM PRODUCTO WHERE nombre = 'Gabardina Clásica Trench'
AND NOT EXISTS (SELECT 1 FROM IMAGEN_PRODUCTO WHERE id_producto = (SELECT id FROM PRODUCTO WHERE nombre = 'Gabardina Clásica Trench'));
INSERT INTO PRODUCTO_SUCURSAL (id_producto, id_sucursal)
SELECT pr.id, s.id FROM PRODUCTO pr, SUCURSAL s
WHERE pr.nombre = 'Gabardina Clásica Trench' AND s.nombre IN ('RVRStyle', 'RVRStyle Beni', 'RVRStyle Sopocachi', 'RVRStyle Cala Cala')
ON CONFLICT DO NOTHING;
INSERT INTO INVENTARIO (id_almacen, id_variante_producto, stock_disponible)
SELECT a.id, v.id, 11
FROM VARIANTE_PRODUCTO v, ALMACEN a
WHERE v.sku IN ('ABR03-BEI-S', 'ABR03-BEI-M', 'ABR03-AZM-S', 'ABR03-AZM-M')
AND a.nombre IN ('Alma001', 'Alma001-S2', 'Almacén Sopocachi', 'Almacén Cala Cala')
ON CONFLICT (id_almacen, id_variante_producto) DO NOTHING;

-- CHQ01: Chaqueta Denim Trucker
INSERT INTO PRODUCTO (id_categoria, nombre, descripcion, precio, descuento_porcentaje)
SELECT id, 'Chaqueta Denim Trucker', 'Chaqueta de denim con botones metálicos y bolsillos frontales. Tela de 12 oz con lavado suave.', 260, 0
FROM CATEGORIA WHERE slug = 'chaquetas'
AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE nombre = 'Chaqueta Denim Trucker');
INSERT INTO VARIANTE_PRODUCTO (id_producto, sku, talla, color, corte)
SELECT pr.id, x.sku, x.talla, x.color, 'Regular'
FROM PRODUCTO pr, (VALUES
  ('CHQ01-AZC-S', 'S', 'Azul Claro'),
  ('CHQ01-AZC-M', 'M', 'Azul Claro'),
  ('CHQ01-NEG-S', 'S', 'Negra'),
  ('CHQ01-NEG-M', 'M', 'Negra')
) AS x(sku, talla, color)
WHERE pr.nombre = 'Chaqueta Denim Trucker'
AND NOT EXISTS (SELECT 1 FROM VARIANTE_PRODUCTO WHERE sku = x.sku);
INSERT INTO IMAGEN_PRODUCTO (id_producto, url, es_principal, orden)
SELECT id, 'https://picsum.photos/seed/CHQ01/640/800', TRUE, 1
FROM PRODUCTO WHERE nombre = 'Chaqueta Denim Trucker'
AND NOT EXISTS (SELECT 1 FROM IMAGEN_PRODUCTO WHERE id_producto = (SELECT id FROM PRODUCTO WHERE nombre = 'Chaqueta Denim Trucker'));
INSERT INTO PRODUCTO_SUCURSAL (id_producto, id_sucursal)
SELECT pr.id, s.id FROM PRODUCTO pr, SUCURSAL s
WHERE pr.nombre = 'Chaqueta Denim Trucker' AND s.nombre IN ('RVRStyle', 'RVRStyle Beni', 'RVRStyle Sopocachi', 'RVRStyle Cala Cala')
ON CONFLICT DO NOTHING;
INSERT INTO INVENTARIO (id_almacen, id_variante_producto, stock_disponible)
SELECT a.id, v.id, 18
FROM VARIANTE_PRODUCTO v, ALMACEN a
WHERE v.sku IN ('CHQ01-AZC-S', 'CHQ01-AZC-M', 'CHQ01-NEG-S', 'CHQ01-NEG-M')
AND a.nombre IN ('Alma001', 'Alma001-S2', 'Almacén Sopocachi', 'Almacén Cala Cala')
ON CONFLICT (id_almacen, id_variante_producto) DO NOTHING;

-- CHQ02: Chaqueta Bomber Satinada
INSERT INTO PRODUCTO (id_categoria, nombre, descripcion, precio, descuento_porcentaje)
SELECT id, 'Chaqueta Bomber Satinada', 'Bomber ligera de tejido satinado con puños y cintura elásticos. Cierre frontal metálico y bolsillos con cierre.', 290, 0
FROM CATEGORIA WHERE slug = 'chaquetas'
AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE nombre = 'Chaqueta Bomber Satinada');
INSERT INTO VARIANTE_PRODUCTO (id_producto, sku, talla, color, corte)
SELECT pr.id, x.sku, x.talla, x.color, 'Regular'
FROM PRODUCTO pr, (VALUES
  ('CHQ02-NEG-S', 'S', 'Negra'),
  ('CHQ02-NEG-M', 'M', 'Negra'),
  ('CHQ02-VME-S', 'S', 'Verde Militar'),
  ('CHQ02-VME-M', 'M', 'Verde Militar')
) AS x(sku, talla, color)
WHERE pr.nombre = 'Chaqueta Bomber Satinada'
AND NOT EXISTS (SELECT 1 FROM VARIANTE_PRODUCTO WHERE sku = x.sku);
INSERT INTO IMAGEN_PRODUCTO (id_producto, url, es_principal, orden)
SELECT id, 'https://picsum.photos/seed/CHQ02/640/800', TRUE, 1
FROM PRODUCTO WHERE nombre = 'Chaqueta Bomber Satinada'
AND NOT EXISTS (SELECT 1 FROM IMAGEN_PRODUCTO WHERE id_producto = (SELECT id FROM PRODUCTO WHERE nombre = 'Chaqueta Bomber Satinada'));
INSERT INTO PRODUCTO_SUCURSAL (id_producto, id_sucursal)
SELECT pr.id, s.id FROM PRODUCTO pr, SUCURSAL s
WHERE pr.nombre = 'Chaqueta Bomber Satinada' AND s.nombre IN ('RVRStyle', 'RVRStyle Beni', 'RVRStyle Sopocachi', 'RVRStyle Cala Cala')
ON CONFLICT DO NOTHING;
INSERT INTO INVENTARIO (id_almacen, id_variante_producto, stock_disponible)
SELECT a.id, v.id, 16
FROM VARIANTE_PRODUCTO v, ALMACEN a
WHERE v.sku IN ('CHQ02-NEG-S', 'CHQ02-NEG-M', 'CHQ02-VME-S', 'CHQ02-VME-M')
AND a.nombre IN ('Alma001', 'Alma001-S2', 'Almacén Sopocachi', 'Almacén Cala Cala')
ON CONFLICT (id_almacen, id_variante_producto) DO NOTHING;

-- CHQ03: Chaqueta Biker Cuero Sintético
INSERT INTO PRODUCTO (id_categoria, nombre, descripcion, precio, descuento_porcentaje)
SELECT id, 'Chaqueta Biker Cuero Sintético', 'Chaqueta estilo biker en cuero sintético con cierres diagonales y forro interior. Acabado mate.', 380, 10
FROM CATEGORIA WHERE slug = 'chaquetas'
AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE nombre = 'Chaqueta Biker Cuero Sintético');
INSERT INTO VARIANTE_PRODUCTO (id_producto, sku, talla, color, corte)
SELECT pr.id, x.sku, x.talla, x.color, 'Entallado'
FROM PRODUCTO pr, (VALUES
  ('CHQ03-NEG-S', 'S', 'Negra'),
  ('CHQ03-NEG-M', 'M', 'Negra'),
  ('CHQ03-CAF-S', 'S', 'Café'),
  ('CHQ03-CAF-M', 'M', 'Café')
) AS x(sku, talla, color)
WHERE pr.nombre = 'Chaqueta Biker Cuero Sintético'
AND NOT EXISTS (SELECT 1 FROM VARIANTE_PRODUCTO WHERE sku = x.sku);
INSERT INTO IMAGEN_PRODUCTO (id_producto, url, es_principal, orden)
SELECT id, 'https://picsum.photos/seed/CHQ03/640/800', TRUE, 1
FROM PRODUCTO WHERE nombre = 'Chaqueta Biker Cuero Sintético'
AND NOT EXISTS (SELECT 1 FROM IMAGEN_PRODUCTO WHERE id_producto = (SELECT id FROM PRODUCTO WHERE nombre = 'Chaqueta Biker Cuero Sintético'));
INSERT INTO PRODUCTO_SUCURSAL (id_producto, id_sucursal)
SELECT pr.id, s.id FROM PRODUCTO pr, SUCURSAL s
WHERE pr.nombre = 'Chaqueta Biker Cuero Sintético' AND s.nombre IN ('RVRStyle', 'RVRStyle Beni', 'RVRStyle Sopocachi')
ON CONFLICT DO NOTHING;
INSERT INTO INVENTARIO (id_almacen, id_variante_producto, stock_disponible)
SELECT a.id, v.id, 13
FROM VARIANTE_PRODUCTO v, ALMACEN a
WHERE v.sku IN ('CHQ03-NEG-S', 'CHQ03-NEG-M', 'CHQ03-CAF-S', 'CHQ03-CAF-M')
AND a.nombre IN ('Alma001', 'Alma001-S2', 'Almacén Sopocachi')
ON CONFLICT (id_almacen, id_variante_producto) DO NOTHING;

-- SUE01: Suéter Tejido Trenzado
INSERT INTO PRODUCTO (id_categoria, nombre, descripcion, precio, descuento_porcentaje)
SELECT id, 'Suéter Tejido Trenzado', 'Suéter de punto trenzado con cuello redondo y puños acanalados. Cálido y de tacto suave.', 230, 0
FROM CATEGORIA WHERE slug = 'sueteres'
AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE nombre = 'Suéter Tejido Trenzado');
INSERT INTO VARIANTE_PRODUCTO (id_producto, sku, talla, color, corte)
SELECT pr.id, x.sku, x.talla, x.color, 'Regular'
FROM PRODUCTO pr, (VALUES
  ('SUE01-CRE-S', 'S', 'Crema'),
  ('SUE01-CRE-M', 'M', 'Crema'),
  ('SUE01-GRJ-S', 'S', 'Gris Jaspe'),
  ('SUE01-GRJ-M', 'M', 'Gris Jaspe'),
  ('SUE01-VIN-S', 'S', 'Vino'),
  ('SUE01-VIN-M', 'M', 'Vino')
) AS x(sku, talla, color)
WHERE pr.nombre = 'Suéter Tejido Trenzado'
AND NOT EXISTS (SELECT 1 FROM VARIANTE_PRODUCTO WHERE sku = x.sku);
INSERT INTO IMAGEN_PRODUCTO (id_producto, url, es_principal, orden)
SELECT id, 'https://picsum.photos/seed/SUE01/640/800', TRUE, 1
FROM PRODUCTO WHERE nombre = 'Suéter Tejido Trenzado'
AND NOT EXISTS (SELECT 1 FROM IMAGEN_PRODUCTO WHERE id_producto = (SELECT id FROM PRODUCTO WHERE nombre = 'Suéter Tejido Trenzado'));
INSERT INTO PRODUCTO_SUCURSAL (id_producto, id_sucursal)
SELECT pr.id, s.id FROM PRODUCTO pr, SUCURSAL s
WHERE pr.nombre = 'Suéter Tejido Trenzado' AND s.nombre IN ('RVRStyle', 'RVRStyle Beni', 'RVRStyle Sopocachi', 'RVRStyle Cala Cala')
ON CONFLICT DO NOTHING;
INSERT INTO INVENTARIO (id_almacen, id_variante_producto, stock_disponible)
SELECT a.id, v.id, 16
FROM VARIANTE_PRODUCTO v, ALMACEN a
WHERE v.sku IN ('SUE01-CRE-S', 'SUE01-CRE-M', 'SUE01-GRJ-S', 'SUE01-GRJ-M', 'SUE01-VIN-S', 'SUE01-VIN-M')
AND a.nombre IN ('Alma001', 'Alma001-S2', 'Almacén Sopocachi', 'Almacén Cala Cala')
ON CONFLICT (id_almacen, id_variante_producto) DO NOTHING;

-- SUE02: Suéter Cuello Alto de Lana
INSERT INTO PRODUCTO (id_categoria, nombre, descripcion, precio, descuento_porcentaje)
SELECT id, 'Suéter Cuello Alto de Lana', 'Suéter de lana mezclada con cuello alto doblado. Se ajusta al cuerpo y se lleva bien bajo un abrigo.', 210, 0
FROM CATEGORIA WHERE slug = 'sueteres'
AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE nombre = 'Suéter Cuello Alto de Lana');
INSERT INTO VARIANTE_PRODUCTO (id_producto, sku, talla, color, corte)
SELECT pr.id, x.sku, x.talla, x.color, 'Ajustado'
FROM PRODUCTO pr, (VALUES
  ('SUE02-NEG-S', 'S', 'Negro'),
  ('SUE02-NEG-M', 'M', 'Negro'),
  ('SUE02-MOS-S', 'S', 'Mostaza'),
  ('SUE02-MOS-M', 'M', 'Mostaza')
) AS x(sku, talla, color)
WHERE pr.nombre = 'Suéter Cuello Alto de Lana'
AND NOT EXISTS (SELECT 1 FROM VARIANTE_PRODUCTO WHERE sku = x.sku);
INSERT INTO IMAGEN_PRODUCTO (id_producto, url, es_principal, orden)
SELECT id, 'https://picsum.photos/seed/SUE02/640/800', TRUE, 1
FROM PRODUCTO WHERE nombre = 'Suéter Cuello Alto de Lana'
AND NOT EXISTS (SELECT 1 FROM IMAGEN_PRODUCTO WHERE id_producto = (SELECT id FROM PRODUCTO WHERE nombre = 'Suéter Cuello Alto de Lana'));
INSERT INTO PRODUCTO_SUCURSAL (id_producto, id_sucursal)
SELECT pr.id, s.id FROM PRODUCTO pr, SUCURSAL s
WHERE pr.nombre = 'Suéter Cuello Alto de Lana' AND s.nombre IN ('RVRStyle', 'RVRStyle Sopocachi', 'RVRStyle Cala Cala')
ON CONFLICT DO NOTHING;
INSERT INTO INVENTARIO (id_almacen, id_variante_producto, stock_disponible)
SELECT a.id, v.id, 14
FROM VARIANTE_PRODUCTO v, ALMACEN a
WHERE v.sku IN ('SUE02-NEG-S', 'SUE02-NEG-M', 'SUE02-MOS-S', 'SUE02-MOS-M')
AND a.nombre IN ('Alma001', 'Almacén Sopocachi', 'Almacén Cala Cala')
ON CONFLICT (id_almacen, id_variante_producto) DO NOTHING;

-- SUE03: Cárdigan Abierto Alpaca Blend
INSERT INTO PRODUCTO (id_categoria, nombre, descripcion, precio, descuento_porcentaje)
SELECT id, 'Cárdigan Abierto Alpaca Blend', 'Cárdigan largo sin cierre en mezcla de alpaca y acrílico. Ligero, abrigado y con bolsillos laterales.', 290, 25
FROM CATEGORIA WHERE slug = 'sueteres'
AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE nombre = 'Cárdigan Abierto Alpaca Blend');
INSERT INTO VARIANTE_PRODUCTO (id_producto, sku, talla, color, corte)
SELECT pr.id, x.sku, x.talla, x.color, 'Oversize'
FROM PRODUCTO pr, (VALUES
  ('SUE03-BEI-S', 'S', 'Beige'),
  ('SUE03-BEI-M', 'M', 'Beige'),
  ('SUE03-GRO-S', 'S', 'Gris Oscuro'),
  ('SUE03-GRO-M', 'M', 'Gris Oscuro')
) AS x(sku, talla, color)
WHERE pr.nombre = 'Cárdigan Abierto Alpaca Blend'
AND NOT EXISTS (SELECT 1 FROM VARIANTE_PRODUCTO WHERE sku = x.sku);
INSERT INTO IMAGEN_PRODUCTO (id_producto, url, es_principal, orden)
SELECT id, 'https://picsum.photos/seed/SUE03/640/800', TRUE, 1
FROM PRODUCTO WHERE nombre = 'Cárdigan Abierto Alpaca Blend'
AND NOT EXISTS (SELECT 1 FROM IMAGEN_PRODUCTO WHERE id_producto = (SELECT id FROM PRODUCTO WHERE nombre = 'Cárdigan Abierto Alpaca Blend'));
INSERT INTO PRODUCTO_SUCURSAL (id_producto, id_sucursal)
SELECT pr.id, s.id FROM PRODUCTO pr, SUCURSAL s
WHERE pr.nombre = 'Cárdigan Abierto Alpaca Blend' AND s.nombre IN ('RVRStyle', 'RVRStyle Sopocachi')
ON CONFLICT DO NOTHING;
INSERT INTO INVENTARIO (id_almacen, id_variante_producto, stock_disponible)
SELECT a.id, v.id, 13
FROM VARIANTE_PRODUCTO v, ALMACEN a
WHERE v.sku IN ('SUE03-BEI-S', 'SUE03-BEI-M', 'SUE03-GRO-S', 'SUE03-GRO-M')
AND a.nombre IN ('Alma001', 'Almacén Sopocachi')
ON CONFLICT (id_almacen, id_variante_producto) DO NOTHING;

-- JEA01: Jean Skinny Tiro Alto
INSERT INTO PRODUCTO (id_categoria, nombre, descripcion, precio, descuento_porcentaje)
SELECT id, 'Jean Skinny Tiro Alto', 'Jean skinny de tiro alto con elastano para mayor comodidad. Cierre metálico y cinco bolsillos.', 260, 0
FROM CATEGORIA WHERE slug = 'jeans'
AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE nombre = 'Jean Skinny Tiro Alto');
INSERT INTO VARIANTE_PRODUCTO (id_producto, sku, talla, color, corte)
SELECT pr.id, x.sku, x.talla, x.color, 'Skinny'
FROM PRODUCTO pr, (VALUES
  ('JEA01-AZO-28', '28', 'Azul Oscuro'),
  ('JEA01-AZO-30', '30', 'Azul Oscuro'),
  ('JEA01-NEG-28', '28', 'Negro'),
  ('JEA01-NEG-30', '30', 'Negro')
) AS x(sku, talla, color)
WHERE pr.nombre = 'Jean Skinny Tiro Alto'
AND NOT EXISTS (SELECT 1 FROM VARIANTE_PRODUCTO WHERE sku = x.sku);
INSERT INTO IMAGEN_PRODUCTO (id_producto, url, es_principal, orden)
SELECT id, 'https://picsum.photos/seed/JEA01/640/800', TRUE, 1
FROM PRODUCTO WHERE nombre = 'Jean Skinny Tiro Alto'
AND NOT EXISTS (SELECT 1 FROM IMAGEN_PRODUCTO WHERE id_producto = (SELECT id FROM PRODUCTO WHERE nombre = 'Jean Skinny Tiro Alto'));
INSERT INTO PRODUCTO_SUCURSAL (id_producto, id_sucursal)
SELECT pr.id, s.id FROM PRODUCTO pr, SUCURSAL s
WHERE pr.nombre = 'Jean Skinny Tiro Alto' AND s.nombre IN ('RVRStyle', 'RVRStyle Beni', 'RVRStyle Sopocachi', 'RVRStyle Cala Cala')
ON CONFLICT DO NOTHING;
INSERT INTO INVENTARIO (id_almacen, id_variante_producto, stock_disponible)
SELECT a.id, v.id, 27
FROM VARIANTE_PRODUCTO v, ALMACEN a
WHERE v.sku IN ('JEA01-AZO-28', 'JEA01-AZO-30', 'JEA01-NEG-28', 'JEA01-NEG-30')
AND a.nombre IN ('Alma001', 'Alma001-S2', 'Almacén Sopocachi', 'Almacén Cala Cala')
ON CONFLICT (id_almacen, id_variante_producto) DO NOTHING;

-- JEA02: Jean Mom Fit
INSERT INTO PRODUCTO (id_categoria, nombre, descripcion, precio, descuento_porcentaje)
SELECT id, 'Jean Mom Fit', 'Jean mom fit de tiro alto y pierna recta, en denim rígido con lavado vintage.', 280, 15
FROM CATEGORIA WHERE slug = 'jeans'
AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE nombre = 'Jean Mom Fit');
INSERT INTO VARIANTE_PRODUCTO (id_producto, sku, talla, color, corte)
SELECT pr.id, x.sku, x.talla, x.color, 'Mom Fit'
FROM PRODUCTO pr, (VALUES
  ('JEA02-AZC-28', '28', 'Azul Claro'),
  ('JEA02-AZC-30', '30', 'Azul Claro'),
  ('JEA02-AZD-28', '28', 'Azul Medio'),
  ('JEA02-AZD-30', '30', 'Azul Medio')
) AS x(sku, talla, color)
WHERE pr.nombre = 'Jean Mom Fit'
AND NOT EXISTS (SELECT 1 FROM VARIANTE_PRODUCTO WHERE sku = x.sku);
INSERT INTO IMAGEN_PRODUCTO (id_producto, url, es_principal, orden)
SELECT id, 'https://picsum.photos/seed/JEA02/640/800', TRUE, 1
FROM PRODUCTO WHERE nombre = 'Jean Mom Fit'
AND NOT EXISTS (SELECT 1 FROM IMAGEN_PRODUCTO WHERE id_producto = (SELECT id FROM PRODUCTO WHERE nombre = 'Jean Mom Fit'));
INSERT INTO PRODUCTO_SUCURSAL (id_producto, id_sucursal)
SELECT pr.id, s.id FROM PRODUCTO pr, SUCURSAL s
WHERE pr.nombre = 'Jean Mom Fit' AND s.nombre IN ('RVRStyle', 'RVRStyle Beni', 'RVRStyle Sopocachi', 'RVRStyle Cala Cala')
ON CONFLICT DO NOTHING;
INSERT INTO INVENTARIO (id_almacen, id_variante_producto, stock_disponible)
SELECT a.id, v.id, 22
FROM VARIANTE_PRODUCTO v, ALMACEN a
WHERE v.sku IN ('JEA02-AZC-28', 'JEA02-AZC-30', 'JEA02-AZD-28', 'JEA02-AZD-30')
AND a.nombre IN ('Alma001', 'Alma001-S2', 'Almacén Sopocachi', 'Almacén Cala Cala')
ON CONFLICT (id_almacen, id_variante_producto) DO NOTHING;

-- JEA03: Jean Wide Leg
INSERT INTO PRODUCTO (id_categoria, nombre, descripcion, precio, descuento_porcentaje)
SELECT id, 'Jean Wide Leg', 'Jean de pierna ancha y tiro alto en denim de peso medio. Largo hasta el tobillo.', 300, 0
FROM CATEGORIA WHERE slug = 'jeans'
AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE nombre = 'Jean Wide Leg');
INSERT INTO VARIANTE_PRODUCTO (id_producto, sku, talla, color, corte)
SELECT pr.id, x.sku, x.talla, x.color, 'Wide Leg'
FROM PRODUCTO pr, (VALUES
  ('JEA03-AZO-28', '28', 'Azul Oscuro'),
  ('JEA03-AZO-30', '30', 'Azul Oscuro'),
  ('JEA03-AZC-28', '28', 'Azul Claro'),
  ('JEA03-AZC-30', '30', 'Azul Claro')
) AS x(sku, talla, color)
WHERE pr.nombre = 'Jean Wide Leg'
AND NOT EXISTS (SELECT 1 FROM VARIANTE_PRODUCTO WHERE sku = x.sku);
INSERT INTO IMAGEN_PRODUCTO (id_producto, url, es_principal, orden)
SELECT id, 'https://picsum.photos/seed/JEA03/640/800', TRUE, 1
FROM PRODUCTO WHERE nombre = 'Jean Wide Leg'
AND NOT EXISTS (SELECT 1 FROM IMAGEN_PRODUCTO WHERE id_producto = (SELECT id FROM PRODUCTO WHERE nombre = 'Jean Wide Leg'));
INSERT INTO PRODUCTO_SUCURSAL (id_producto, id_sucursal)
SELECT pr.id, s.id FROM PRODUCTO pr, SUCURSAL s
WHERE pr.nombre = 'Jean Wide Leg' AND s.nombre IN ('RVRStyle', 'RVRStyle Beni', 'RVRStyle Sopocachi', 'RVRStyle Cala Cala')
ON CONFLICT DO NOTHING;
INSERT INTO INVENTARIO (id_almacen, id_variante_producto, stock_disponible)
SELECT a.id, v.id, 18
FROM VARIANTE_PRODUCTO v, ALMACEN a
WHERE v.sku IN ('JEA03-AZO-28', 'JEA03-AZO-30', 'JEA03-AZC-28', 'JEA03-AZC-30')
AND a.nombre IN ('Alma001', 'Alma001-S2', 'Almacén Sopocachi', 'Almacén Cala Cala')
ON CONFLICT (id_almacen, id_variante_producto) DO NOTHING;

-- FAL01: Falda Midi Plisada
INSERT INTO PRODUCTO (id_categoria, nombre, descripcion, precio, descuento_porcentaje)
SELECT id, 'Falda Midi Plisada', 'Falda midi con plisado permanente y cintura elástica. Tela fluida que se mueve con cada paso.', 180, 0
FROM CATEGORIA WHERE slug = 'faldas'
AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE nombre = 'Falda Midi Plisada');
INSERT INTO VARIANTE_PRODUCTO (id_producto, sku, talla, color, corte)
SELECT pr.id, x.sku, x.talla, x.color, 'Plisado'
FROM PRODUCTO pr, (VALUES
  ('FAL01-NEG-S', 'S', 'Negra'),
  ('FAL01-NEG-M', 'M', 'Negra'),
  ('FAL01-VIN-S', 'S', 'Vino'),
  ('FAL01-VIN-M', 'M', 'Vino'),
  ('FAL01-BEI-S', 'S', 'Beige'),
  ('FAL01-BEI-M', 'M', 'Beige')
) AS x(sku, talla, color)
WHERE pr.nombre = 'Falda Midi Plisada'
AND NOT EXISTS (SELECT 1 FROM VARIANTE_PRODUCTO WHERE sku = x.sku);
INSERT INTO IMAGEN_PRODUCTO (id_producto, url, es_principal, orden)
SELECT id, 'https://picsum.photos/seed/FAL01/640/800', TRUE, 1
FROM PRODUCTO WHERE nombre = 'Falda Midi Plisada'
AND NOT EXISTS (SELECT 1 FROM IMAGEN_PRODUCTO WHERE id_producto = (SELECT id FROM PRODUCTO WHERE nombre = 'Falda Midi Plisada'));
INSERT INTO PRODUCTO_SUCURSAL (id_producto, id_sucursal)
SELECT pr.id, s.id FROM PRODUCTO pr, SUCURSAL s
WHERE pr.nombre = 'Falda Midi Plisada' AND s.nombre IN ('RVRStyle', 'RVRStyle Beni', 'RVRStyle Sopocachi', 'RVRStyle Cala Cala')
ON CONFLICT DO NOTHING;
INSERT INTO INVENTARIO (id_almacen, id_variante_producto, stock_disponible)
SELECT a.id, v.id, 18
FROM VARIANTE_PRODUCTO v, ALMACEN a
WHERE v.sku IN ('FAL01-NEG-S', 'FAL01-NEG-M', 'FAL01-VIN-S', 'FAL01-VIN-M', 'FAL01-BEI-S', 'FAL01-BEI-M')
AND a.nombre IN ('Alma001', 'Alma001-S2', 'Almacén Sopocachi', 'Almacén Cala Cala')
ON CONFLICT (id_almacen, id_variante_producto) DO NOTHING;

-- FAL02: Falda Denim Mini
INSERT INTO PRODUCTO (id_categoria, nombre, descripcion, precio, descuento_porcentaje)
SELECT id, 'Falda Denim Mini', 'Minifalda de denim con botones al frente y dos bolsillos. Ideal con polera básica y zapatillas.', 150, 0
FROM CATEGORIA WHERE slug = 'faldas'
AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE nombre = 'Falda Denim Mini');
INSERT INTO VARIANTE_PRODUCTO (id_producto, sku, talla, color, corte)
SELECT pr.id, x.sku, x.talla, x.color, 'Recto'
FROM PRODUCTO pr, (VALUES
  ('FAL02-AZC-S', 'S', 'Azul Claro'),
  ('FAL02-AZC-M', 'M', 'Azul Claro'),
  ('FAL02-AZO-S', 'S', 'Azul Oscuro'),
  ('FAL02-AZO-M', 'M', 'Azul Oscuro')
) AS x(sku, talla, color)
WHERE pr.nombre = 'Falda Denim Mini'
AND NOT EXISTS (SELECT 1 FROM VARIANTE_PRODUCTO WHERE sku = x.sku);
INSERT INTO IMAGEN_PRODUCTO (id_producto, url, es_principal, orden)
SELECT id, 'https://picsum.photos/seed/FAL02/640/800', TRUE, 1
FROM PRODUCTO WHERE nombre = 'Falda Denim Mini'
AND NOT EXISTS (SELECT 1 FROM IMAGEN_PRODUCTO WHERE id_producto = (SELECT id FROM PRODUCTO WHERE nombre = 'Falda Denim Mini'));
INSERT INTO PRODUCTO_SUCURSAL (id_producto, id_sucursal)
SELECT pr.id, s.id FROM PRODUCTO pr, SUCURSAL s
WHERE pr.nombre = 'Falda Denim Mini' AND s.nombre IN ('RVRStyle', 'RVRStyle Beni', 'RVRStyle Sopocachi', 'RVRStyle Cala Cala')
ON CONFLICT DO NOTHING;
INSERT INTO INVENTARIO (id_almacen, id_variante_producto, stock_disponible)
SELECT a.id, v.id, 20
FROM VARIANTE_PRODUCTO v, ALMACEN a
WHERE v.sku IN ('FAL02-AZC-S', 'FAL02-AZC-M', 'FAL02-AZO-S', 'FAL02-AZO-M')
AND a.nombre IN ('Alma001', 'Alma001-S2', 'Almacén Sopocachi', 'Almacén Cala Cala')
ON CONFLICT (id_almacen, id_variante_producto) DO NOTHING;

-- FAL03: Falda Cruzada de Lino
INSERT INTO PRODUCTO (id_categoria, nombre, descripcion, precio, descuento_porcentaje)
SELECT id, 'Falda Cruzada de Lino', 'Falda cruzada de lino con cierre de amarre lateral. Fresca y liviana para el verano.', 165, 0
FROM CATEGORIA WHERE slug = 'faldas'
AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE nombre = 'Falda Cruzada de Lino');
INSERT INTO VARIANTE_PRODUCTO (id_producto, sku, talla, color, corte)
SELECT pr.id, x.sku, x.talla, x.color, 'Cruzado'
FROM PRODUCTO pr, (VALUES
  ('FAL03-BEI-S', 'S', 'Beige'),
  ('FAL03-BEI-M', 'M', 'Beige'),
  ('FAL03-BLA-S', 'S', 'Blanca'),
  ('FAL03-BLA-M', 'M', 'Blanca')
) AS x(sku, talla, color)
WHERE pr.nombre = 'Falda Cruzada de Lino'
AND NOT EXISTS (SELECT 1 FROM VARIANTE_PRODUCTO WHERE sku = x.sku);
INSERT INTO IMAGEN_PRODUCTO (id_producto, url, es_principal, orden)
SELECT id, 'https://picsum.photos/seed/FAL03/640/800', TRUE, 1
FROM PRODUCTO WHERE nombre = 'Falda Cruzada de Lino'
AND NOT EXISTS (SELECT 1 FROM IMAGEN_PRODUCTO WHERE id_producto = (SELECT id FROM PRODUCTO WHERE nombre = 'Falda Cruzada de Lino'));
INSERT INTO PRODUCTO_SUCURSAL (id_producto, id_sucursal)
SELECT pr.id, s.id FROM PRODUCTO pr, SUCURSAL s
WHERE pr.nombre = 'Falda Cruzada de Lino' AND s.nombre IN ('RVRStyle', 'RVRStyle Beni', 'RVRStyle Sopocachi', 'RVRStyle Cala Cala')
ON CONFLICT DO NOTHING;
INSERT INTO INVENTARIO (id_almacen, id_variante_producto, stock_disponible)
SELECT a.id, v.id, 14
FROM VARIANTE_PRODUCTO v, ALMACEN a
WHERE v.sku IN ('FAL03-BEI-S', 'FAL03-BEI-M', 'FAL03-BLA-S', 'FAL03-BLA-M')
AND a.nombre IN ('Alma001', 'Alma001-S2', 'Almacén Sopocachi', 'Almacén Cala Cala')
ON CONFLICT (id_almacen, id_variante_producto) DO NOTHING;

-- SHO01: Short Denim Desgastado
INSERT INTO PRODUCTO (id_categoria, nombre, descripcion, precio, descuento_porcentaje)
SELECT id, 'Short Denim Desgastado', 'Short de denim con efecto desgastado y dobladillo deshilachado. Tiro medio y cierre con botón.', 140, 0
FROM CATEGORIA WHERE slug = 'shorts'
AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE nombre = 'Short Denim Desgastado');
INSERT INTO VARIANTE_PRODUCTO (id_producto, sku, talla, color, corte)
SELECT pr.id, x.sku, x.talla, x.color, 'Regular'
FROM PRODUCTO pr, (VALUES
  ('SHO01-AZC-S', 'S', 'Azul Claro'),
  ('SHO01-AZC-M', 'M', 'Azul Claro'),
  ('SHO01-NEG-S', 'S', 'Negro'),
  ('SHO01-NEG-M', 'M', 'Negro')
) AS x(sku, talla, color)
WHERE pr.nombre = 'Short Denim Desgastado'
AND NOT EXISTS (SELECT 1 FROM VARIANTE_PRODUCTO WHERE sku = x.sku);
INSERT INTO IMAGEN_PRODUCTO (id_producto, url, es_principal, orden)
SELECT id, 'https://picsum.photos/seed/SHO01/640/800', TRUE, 1
FROM PRODUCTO WHERE nombre = 'Short Denim Desgastado'
AND NOT EXISTS (SELECT 1 FROM IMAGEN_PRODUCTO WHERE id_producto = (SELECT id FROM PRODUCTO WHERE nombre = 'Short Denim Desgastado'));
INSERT INTO PRODUCTO_SUCURSAL (id_producto, id_sucursal)
SELECT pr.id, s.id FROM PRODUCTO pr, SUCURSAL s
WHERE pr.nombre = 'Short Denim Desgastado' AND s.nombre IN ('RVRStyle', 'RVRStyle Beni', 'RVRStyle Sopocachi', 'RVRStyle Cala Cala')
ON CONFLICT DO NOTHING;
INSERT INTO INVENTARIO (id_almacen, id_variante_producto, stock_disponible)
SELECT a.id, v.id, 22
FROM VARIANTE_PRODUCTO v, ALMACEN a
WHERE v.sku IN ('SHO01-AZC-S', 'SHO01-AZC-M', 'SHO01-NEG-S', 'SHO01-NEG-M')
AND a.nombre IN ('Alma001', 'Alma001-S2', 'Almacén Sopocachi', 'Almacén Cala Cala')
ON CONFLICT (id_almacen, id_variante_producto) DO NOTHING;

-- SHO02: Short Cargo de Algodón
INSERT INTO PRODUCTO (id_categoria, nombre, descripcion, precio, descuento_porcentaje)
SELECT id, 'Short Cargo de Algodón', 'Short cargo de sarga de algodón con bolsillos laterales de parche y cintura con cordón.', 130, 10
FROM CATEGORIA WHERE slug = 'shorts'
AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE nombre = 'Short Cargo de Algodón');
INSERT INTO VARIANTE_PRODUCTO (id_producto, sku, talla, color, corte)
SELECT pr.id, x.sku, x.talla, x.color, 'Cargo'
FROM PRODUCTO pr, (VALUES
  ('SHO02-BEI-S', 'S', 'Beige'),
  ('SHO02-BEI-M', 'M', 'Beige'),
  ('SHO02-VOL-S', 'S', 'Verde Oliva'),
  ('SHO02-VOL-M', 'M', 'Verde Oliva')
) AS x(sku, talla, color)
WHERE pr.nombre = 'Short Cargo de Algodón'
AND NOT EXISTS (SELECT 1 FROM VARIANTE_PRODUCTO WHERE sku = x.sku);
INSERT INTO IMAGEN_PRODUCTO (id_producto, url, es_principal, orden)
SELECT id, 'https://picsum.photos/seed/SHO02/640/800', TRUE, 1
FROM PRODUCTO WHERE nombre = 'Short Cargo de Algodón'
AND NOT EXISTS (SELECT 1 FROM IMAGEN_PRODUCTO WHERE id_producto = (SELECT id FROM PRODUCTO WHERE nombre = 'Short Cargo de Algodón'));
INSERT INTO PRODUCTO_SUCURSAL (id_producto, id_sucursal)
SELECT pr.id, s.id FROM PRODUCTO pr, SUCURSAL s
WHERE pr.nombre = 'Short Cargo de Algodón' AND s.nombre IN ('RVRStyle', 'RVRStyle Beni', 'RVRStyle Sopocachi', 'RVRStyle Cala Cala')
ON CONFLICT DO NOTHING;
INSERT INTO INVENTARIO (id_almacen, id_variante_producto, stock_disponible)
SELECT a.id, v.id, 16
FROM VARIANTE_PRODUCTO v, ALMACEN a
WHERE v.sku IN ('SHO02-BEI-S', 'SHO02-BEI-M', 'SHO02-VOL-S', 'SHO02-VOL-M')
AND a.nombre IN ('Alma001', 'Alma001-S2', 'Almacén Sopocachi', 'Almacén Cala Cala')
ON CONFLICT (id_almacen, id_variante_producto) DO NOTHING;

-- SHO03: Short Deportivo Dry-Fit
INSERT INTO PRODUCTO (id_categoria, nombre, descripcion, precio, descuento_porcentaje)
SELECT id, 'Short Deportivo Dry-Fit', 'Short deportivo de secado rápido con malla interior y bolsillo con cierre. Cintura elástica.', 90, 0
FROM CATEGORIA WHERE slug = 'shorts'
AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE nombre = 'Short Deportivo Dry-Fit');
INSERT INTO VARIANTE_PRODUCTO (id_producto, sku, talla, color, corte)
SELECT pr.id, x.sku, x.talla, x.color, 'Regular'
FROM PRODUCTO pr, (VALUES
  ('SHO03-NEG-S', 'S', 'Negro'),
  ('SHO03-NEG-M', 'M', 'Negro'),
  ('SHO03-GRJ-S', 'S', 'Gris Jaspe'),
  ('SHO03-GRJ-M', 'M', 'Gris Jaspe')
) AS x(sku, talla, color)
WHERE pr.nombre = 'Short Deportivo Dry-Fit'
AND NOT EXISTS (SELECT 1 FROM VARIANTE_PRODUCTO WHERE sku = x.sku);
INSERT INTO IMAGEN_PRODUCTO (id_producto, url, es_principal, orden)
SELECT id, 'https://picsum.photos/seed/SHO03/640/800', TRUE, 1
FROM PRODUCTO WHERE nombre = 'Short Deportivo Dry-Fit'
AND NOT EXISTS (SELECT 1 FROM IMAGEN_PRODUCTO WHERE id_producto = (SELECT id FROM PRODUCTO WHERE nombre = 'Short Deportivo Dry-Fit'));
INSERT INTO PRODUCTO_SUCURSAL (id_producto, id_sucursal)
SELECT pr.id, s.id FROM PRODUCTO pr, SUCURSAL s
WHERE pr.nombre = 'Short Deportivo Dry-Fit' AND s.nombre IN ('RVRStyle', 'RVRStyle Beni', 'RVRStyle Sopocachi')
ON CONFLICT DO NOTHING;
INSERT INTO INVENTARIO (id_almacen, id_variante_producto, stock_disponible)
SELECT a.id, v.id, 18
FROM VARIANTE_PRODUCTO v, ALMACEN a
WHERE v.sku IN ('SHO03-NEG-S', 'SHO03-NEG-M', 'SHO03-GRJ-S', 'SHO03-GRJ-M')
AND a.nombre IN ('Alma001', 'Alma001-S2', 'Almacén Sopocachi')
ON CONFLICT (id_almacen, id_variante_producto) DO NOTHING;

-- VES01: Vestido Floral Midi
INSERT INTO PRODUCTO (id_categoria, nombre, descripcion, precio, descuento_porcentaje)
SELECT id, 'Vestido Floral Midi', 'Vestido midi de viscosa con estampado floral, escote en V y falda evasé. Ligero y fresco.', 320, 20
FROM CATEGORIA WHERE slug = 'vestidos'
AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE nombre = 'Vestido Floral Midi');
INSERT INTO VARIANTE_PRODUCTO (id_producto, sku, talla, color, corte)
SELECT pr.id, x.sku, x.talla, x.color, 'Evasé'
FROM PRODUCTO pr, (VALUES
  ('VES01-FLZ-S', 'S', 'Floral Azul'),
  ('VES01-FLZ-M', 'M', 'Floral Azul'),
  ('VES01-FLR-S', 'S', 'Floral Rosa'),
  ('VES01-FLR-M', 'M', 'Floral Rosa')
) AS x(sku, talla, color)
WHERE pr.nombre = 'Vestido Floral Midi'
AND NOT EXISTS (SELECT 1 FROM VARIANTE_PRODUCTO WHERE sku = x.sku);
INSERT INTO IMAGEN_PRODUCTO (id_producto, url, es_principal, orden)
SELECT id, 'https://picsum.photos/seed/VES01/640/800', TRUE, 1
FROM PRODUCTO WHERE nombre = 'Vestido Floral Midi'
AND NOT EXISTS (SELECT 1 FROM IMAGEN_PRODUCTO WHERE id_producto = (SELECT id FROM PRODUCTO WHERE nombre = 'Vestido Floral Midi'));
INSERT INTO PRODUCTO_SUCURSAL (id_producto, id_sucursal)
SELECT pr.id, s.id FROM PRODUCTO pr, SUCURSAL s
WHERE pr.nombre = 'Vestido Floral Midi' AND s.nombre IN ('RVRStyle', 'RVRStyle Beni', 'RVRStyle Sopocachi', 'RVRStyle Cala Cala')
ON CONFLICT DO NOTHING;
INSERT INTO INVENTARIO (id_almacen, id_variante_producto, stock_disponible)
SELECT a.id, v.id, 20
FROM VARIANTE_PRODUCTO v, ALMACEN a
WHERE v.sku IN ('VES01-FLZ-S', 'VES01-FLZ-M', 'VES01-FLR-S', 'VES01-FLR-M')
AND a.nombre IN ('Alma001', 'Alma001-S2', 'Almacén Sopocachi', 'Almacén Cala Cala')
ON CONFLICT (id_almacen, id_variante_producto) DO NOTHING;

-- VES02: Vestido Cóctel Ajustado
INSERT INTO PRODUCTO (id_categoria, nombre, descripcion, precio, descuento_porcentaje)
SELECT id, 'Vestido Cóctel Ajustado', 'Vestido de cóctel entallado con manga tres cuartos y cierre invisible en la espalda. Largo a la rodilla.', 380, 0
FROM CATEGORIA WHERE slug = 'vestidos'
AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE nombre = 'Vestido Cóctel Ajustado');
INSERT INTO VARIANTE_PRODUCTO (id_producto, sku, talla, color, corte)
SELECT pr.id, x.sku, x.talla, x.color, 'Entallado'
FROM PRODUCTO pr, (VALUES
  ('VES02-NEG-S', 'S', 'Negro'),
  ('VES02-NEG-M', 'M', 'Negro'),
  ('VES02-VIN-S', 'S', 'Vino'),
  ('VES02-VIN-M', 'M', 'Vino')
) AS x(sku, talla, color)
WHERE pr.nombre = 'Vestido Cóctel Ajustado'
AND NOT EXISTS (SELECT 1 FROM VARIANTE_PRODUCTO WHERE sku = x.sku);
INSERT INTO IMAGEN_PRODUCTO (id_producto, url, es_principal, orden)
SELECT id, 'https://picsum.photos/seed/VES02/640/800', TRUE, 1
FROM PRODUCTO WHERE nombre = 'Vestido Cóctel Ajustado'
AND NOT EXISTS (SELECT 1 FROM IMAGEN_PRODUCTO WHERE id_producto = (SELECT id FROM PRODUCTO WHERE nombre = 'Vestido Cóctel Ajustado'));
INSERT INTO PRODUCTO_SUCURSAL (id_producto, id_sucursal)
SELECT pr.id, s.id FROM PRODUCTO pr, SUCURSAL s
WHERE pr.nombre = 'Vestido Cóctel Ajustado' AND s.nombre IN ('RVRStyle', 'RVRStyle Beni', 'RVRStyle Sopocachi', 'RVRStyle Cala Cala')
ON CONFLICT DO NOTHING;
INSERT INTO INVENTARIO (id_almacen, id_variante_producto, stock_disponible)
SELECT a.id, v.id, 14
FROM VARIANTE_PRODUCTO v, ALMACEN a
WHERE v.sku IN ('VES02-NEG-S', 'VES02-NEG-M', 'VES02-VIN-S', 'VES02-VIN-M')
AND a.nombre IN ('Alma001', 'Alma001-S2', 'Almacén Sopocachi', 'Almacén Cala Cala')
ON CONFLICT (id_almacen, id_variante_producto) DO NOTHING;

-- VES03: Vestido Camisero de Lino
INSERT INTO PRODUCTO (id_categoria, nombre, descripcion, precio, descuento_porcentaje)
SELECT id, 'Vestido Camisero de Lino', 'Vestido camisero de lino con botones frontales, cinturón de tela y bolsillos laterales.', 290, 0
FROM CATEGORIA WHERE slug = 'vestidos'
AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE nombre = 'Vestido Camisero de Lino');
INSERT INTO VARIANTE_PRODUCTO (id_producto, sku, talla, color, corte)
SELECT pr.id, x.sku, x.talla, x.color, 'Recto'
FROM PRODUCTO pr, (VALUES
  ('VES03-BEI-S', 'S', 'Beige'),
  ('VES03-BEI-M', 'M', 'Beige'),
  ('VES03-BLA-S', 'S', 'Blanco'),
  ('VES03-BLA-M', 'M', 'Blanco')
) AS x(sku, talla, color)
WHERE pr.nombre = 'Vestido Camisero de Lino'
AND NOT EXISTS (SELECT 1 FROM VARIANTE_PRODUCTO WHERE sku = x.sku);
INSERT INTO IMAGEN_PRODUCTO (id_producto, url, es_principal, orden)
SELECT id, 'https://picsum.photos/seed/VES03/640/800', TRUE, 1
FROM PRODUCTO WHERE nombre = 'Vestido Camisero de Lino'
AND NOT EXISTS (SELECT 1 FROM IMAGEN_PRODUCTO WHERE id_producto = (SELECT id FROM PRODUCTO WHERE nombre = 'Vestido Camisero de Lino'));
INSERT INTO PRODUCTO_SUCURSAL (id_producto, id_sucursal)
SELECT pr.id, s.id FROM PRODUCTO pr, SUCURSAL s
WHERE pr.nombre = 'Vestido Camisero de Lino' AND s.nombre IN ('RVRStyle', 'RVRStyle Beni', 'RVRStyle Sopocachi', 'RVRStyle Cala Cala')
ON CONFLICT DO NOTHING;
INSERT INTO INVENTARIO (id_almacen, id_variante_producto, stock_disponible)
SELECT a.id, v.id, 16
FROM VARIANTE_PRODUCTO v, ALMACEN a
WHERE v.sku IN ('VES03-BEI-S', 'VES03-BEI-M', 'VES03-BLA-S', 'VES03-BLA-M')
AND a.nombre IN ('Alma001', 'Alma001-S2', 'Almacén Sopocachi', 'Almacén Cala Cala')
ON CONFLICT (id_almacen, id_variante_producto) DO NOTHING;

-- ENT01: Enterizo Jean Cargo
INSERT INTO PRODUCTO (id_categoria, nombre, descripcion, precio, descuento_porcentaje)
SELECT id, 'Enterizo Jean Cargo', 'Enterizo de denim estilo cargo con tirantes ajustables, bolsillos amplios y cintura marcada.', 340, 0
FROM CATEGORIA WHERE slug = 'enterizos'
AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE nombre = 'Enterizo Jean Cargo');
INSERT INTO VARIANTE_PRODUCTO (id_producto, sku, talla, color, corte)
SELECT pr.id, x.sku, x.talla, x.color, 'Regular'
FROM PRODUCTO pr, (VALUES
  ('ENT01-AZC-S', 'S', 'Azul Claro'),
  ('ENT01-AZC-M', 'M', 'Azul Claro'),
  ('ENT01-NEG-S', 'S', 'Negro'),
  ('ENT01-NEG-M', 'M', 'Negro')
) AS x(sku, talla, color)
WHERE pr.nombre = 'Enterizo Jean Cargo'
AND NOT EXISTS (SELECT 1 FROM VARIANTE_PRODUCTO WHERE sku = x.sku);
INSERT INTO IMAGEN_PRODUCTO (id_producto, url, es_principal, orden)
SELECT id, 'https://picsum.photos/seed/ENT01/640/800', TRUE, 1
FROM PRODUCTO WHERE nombre = 'Enterizo Jean Cargo'
AND NOT EXISTS (SELECT 1 FROM IMAGEN_PRODUCTO WHERE id_producto = (SELECT id FROM PRODUCTO WHERE nombre = 'Enterizo Jean Cargo'));
INSERT INTO PRODUCTO_SUCURSAL (id_producto, id_sucursal)
SELECT pr.id, s.id FROM PRODUCTO pr, SUCURSAL s
WHERE pr.nombre = 'Enterizo Jean Cargo' AND s.nombre IN ('RVRStyle', 'RVRStyle Beni', 'RVRStyle Sopocachi', 'RVRStyle Cala Cala')
ON CONFLICT DO NOTHING;
INSERT INTO INVENTARIO (id_almacen, id_variante_producto, stock_disponible)
SELECT a.id, v.id, 13
FROM VARIANTE_PRODUCTO v, ALMACEN a
WHERE v.sku IN ('ENT01-AZC-S', 'ENT01-AZC-M', 'ENT01-NEG-S', 'ENT01-NEG-M')
AND a.nombre IN ('Alma001', 'Alma001-S2', 'Almacén Sopocachi', 'Almacén Cala Cala')
ON CONFLICT (id_almacen, id_variante_producto) DO NOTHING;

-- ENT02: Enterizo Corto de Verano
INSERT INTO PRODUCTO (id_categoria, nombre, descripcion, precio, descuento_porcentaje)
SELECT id, 'Enterizo Corto de Verano', 'Enterizo corto de algodón con tirantes y cintura elástica. Fresco para los días de calor.', 230, 0
FROM CATEGORIA WHERE slug = 'enterizos'
AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE nombre = 'Enterizo Corto de Verano');
INSERT INTO VARIANTE_PRODUCTO (id_producto, sku, talla, color, corte)
SELECT pr.id, x.sku, x.talla, x.color, 'Corto'
FROM PRODUCTO pr, (VALUES
  ('ENT02-BLA-S', 'S', 'Blanco'),
  ('ENT02-BLA-M', 'M', 'Blanco'),
  ('ENT02-TUR-S', 'S', 'Turquesa'),
  ('ENT02-TUR-M', 'M', 'Turquesa')
) AS x(sku, talla, color)
WHERE pr.nombre = 'Enterizo Corto de Verano'
AND NOT EXISTS (SELECT 1 FROM VARIANTE_PRODUCTO WHERE sku = x.sku);
INSERT INTO IMAGEN_PRODUCTO (id_producto, url, es_principal, orden)
SELECT id, 'https://picsum.photos/seed/ENT02/640/800', TRUE, 1
FROM PRODUCTO WHERE nombre = 'Enterizo Corto de Verano'
AND NOT EXISTS (SELECT 1 FROM IMAGEN_PRODUCTO WHERE id_producto = (SELECT id FROM PRODUCTO WHERE nombre = 'Enterizo Corto de Verano'));
INSERT INTO PRODUCTO_SUCURSAL (id_producto, id_sucursal)
SELECT pr.id, s.id FROM PRODUCTO pr, SUCURSAL s
WHERE pr.nombre = 'Enterizo Corto de Verano' AND s.nombre IN ('RVRStyle', 'RVRStyle Beni', 'RVRStyle Sopocachi', 'RVRStyle Cala Cala')
ON CONFLICT DO NOTHING;
INSERT INTO INVENTARIO (id_almacen, id_variante_producto, stock_disponible)
SELECT a.id, v.id, 16
FROM VARIANTE_PRODUCTO v, ALMACEN a
WHERE v.sku IN ('ENT02-BLA-S', 'ENT02-BLA-M', 'ENT02-TUR-S', 'ENT02-TUR-M')
AND a.nombre IN ('Alma001', 'Alma001-S2', 'Almacén Sopocachi', 'Almacén Cala Cala')
ON CONFLICT (id_almacen, id_variante_producto) DO NOTHING;

-- ENT03: Enterizo Satinado de Fiesta
INSERT INTO PRODUCTO (id_categoria, nombre, descripcion, precio, descuento_porcentaje)
SELECT id, 'Enterizo Satinado de Fiesta', 'Enterizo de satén con escote cruzado y pierna recta. Cierre invisible lateral.', 360, 0
FROM CATEGORIA WHERE slug = 'enterizos'
AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE nombre = 'Enterizo Satinado de Fiesta');
INSERT INTO VARIANTE_PRODUCTO (id_producto, sku, talla, color, corte)
SELECT pr.id, x.sku, x.talla, x.color, 'Entallado'
FROM PRODUCTO pr, (VALUES
  ('ENT03-NEG-S', 'S', 'Negro'),
  ('ENT03-NEG-M', 'M', 'Negro'),
  ('ENT03-VES-S', 'S', 'Verde Esmeralda'),
  ('ENT03-VES-M', 'M', 'Verde Esmeralda')
) AS x(sku, talla, color)
WHERE pr.nombre = 'Enterizo Satinado de Fiesta'
AND NOT EXISTS (SELECT 1 FROM VARIANTE_PRODUCTO WHERE sku = x.sku);
INSERT INTO IMAGEN_PRODUCTO (id_producto, url, es_principal, orden)
SELECT id, 'https://picsum.photos/seed/ENT03/640/800', TRUE, 1
FROM PRODUCTO WHERE nombre = 'Enterizo Satinado de Fiesta'
AND NOT EXISTS (SELECT 1 FROM IMAGEN_PRODUCTO WHERE id_producto = (SELECT id FROM PRODUCTO WHERE nombre = 'Enterizo Satinado de Fiesta'));
INSERT INTO PRODUCTO_SUCURSAL (id_producto, id_sucursal)
SELECT pr.id, s.id FROM PRODUCTO pr, SUCURSAL s
WHERE pr.nombre = 'Enterizo Satinado de Fiesta' AND s.nombre IN ('RVRStyle', 'RVRStyle Beni', 'RVRStyle Sopocachi')
ON CONFLICT DO NOTHING;
INSERT INTO INVENTARIO (id_almacen, id_variante_producto, stock_disponible)
SELECT a.id, v.id, 11
FROM VARIANTE_PRODUCTO v, ALMACEN a
WHERE v.sku IN ('ENT03-NEG-S', 'ENT03-NEG-M', 'ENT03-VES-S', 'ENT03-VES-M')
AND a.nombre IN ('Alma001', 'Alma001-S2', 'Almacén Sopocachi')
ON CONFLICT (id_almacen, id_variante_producto) DO NOTHING;

-- MON01: Mono Largo de Tela Fluida
INSERT INTO PRODUCTO (id_categoria, nombre, descripcion, precio, descuento_porcentaje)
SELECT id, 'Mono Largo de Tela Fluida', 'Mono largo de crepé fluido con pierna ancha, cinturón de tela y bolsillos ocultos.', 310, 0
FROM CATEGORIA WHERE slug = 'monos'
AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE nombre = 'Mono Largo de Tela Fluida');
INSERT INTO VARIANTE_PRODUCTO (id_producto, sku, talla, color, corte)
SELECT pr.id, x.sku, x.talla, x.color, 'Wide Leg'
FROM PRODUCTO pr, (VALUES
  ('MON01-NEG-S', 'S', 'Negro'),
  ('MON01-NEG-M', 'M', 'Negro'),
  ('MON01-VES-S', 'S', 'Verde Esmeralda'),
  ('MON01-VES-M', 'M', 'Verde Esmeralda')
) AS x(sku, talla, color)
WHERE pr.nombre = 'Mono Largo de Tela Fluida'
AND NOT EXISTS (SELECT 1 FROM VARIANTE_PRODUCTO WHERE sku = x.sku);
INSERT INTO IMAGEN_PRODUCTO (id_producto, url, es_principal, orden)
SELECT id, 'https://picsum.photos/seed/MON01/640/800', TRUE, 1
FROM PRODUCTO WHERE nombre = 'Mono Largo de Tela Fluida'
AND NOT EXISTS (SELECT 1 FROM IMAGEN_PRODUCTO WHERE id_producto = (SELECT id FROM PRODUCTO WHERE nombre = 'Mono Largo de Tela Fluida'));
INSERT INTO PRODUCTO_SUCURSAL (id_producto, id_sucursal)
SELECT pr.id, s.id FROM PRODUCTO pr, SUCURSAL s
WHERE pr.nombre = 'Mono Largo de Tela Fluida' AND s.nombre IN ('RVRStyle', 'RVRStyle Beni', 'RVRStyle Sopocachi', 'RVRStyle Cala Cala')
ON CONFLICT DO NOTHING;
INSERT INTO INVENTARIO (id_almacen, id_variante_producto, stock_disponible)
SELECT a.id, v.id, 14
FROM VARIANTE_PRODUCTO v, ALMACEN a
WHERE v.sku IN ('MON01-NEG-S', 'MON01-NEG-M', 'MON01-VES-S', 'MON01-VES-M')
AND a.nombre IN ('Alma001', 'Alma001-S2', 'Almacén Sopocachi', 'Almacén Cala Cala')
ON CONFLICT (id_almacen, id_variante_producto) DO NOTHING;

-- MON02: Mono Tirantes de Lino
INSERT INTO PRODUCTO (id_categoria, nombre, descripcion, precio, descuento_porcentaje)
SELECT id, 'Mono Tirantes de Lino', 'Mono de lino con tirantes anchos, pierna recta y bolsillos delanteros. Cómodo y elegante a la vez.', 270, 0
FROM CATEGORIA WHERE slug = 'monos'
AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE nombre = 'Mono Tirantes de Lino');
INSERT INTO VARIANTE_PRODUCTO (id_producto, sku, talla, color, corte)
SELECT pr.id, x.sku, x.talla, x.color, 'Recto'
FROM PRODUCTO pr, (VALUES
  ('MON02-BEI-S', 'S', 'Beige'),
  ('MON02-BEI-M', 'M', 'Beige'),
  ('MON02-BLA-S', 'S', 'Blanco'),
  ('MON02-BLA-M', 'M', 'Blanco')
) AS x(sku, talla, color)
WHERE pr.nombre = 'Mono Tirantes de Lino'
AND NOT EXISTS (SELECT 1 FROM VARIANTE_PRODUCTO WHERE sku = x.sku);
INSERT INTO IMAGEN_PRODUCTO (id_producto, url, es_principal, orden)
SELECT id, 'https://picsum.photos/seed/MON02/640/800', TRUE, 1
FROM PRODUCTO WHERE nombre = 'Mono Tirantes de Lino'
AND NOT EXISTS (SELECT 1 FROM IMAGEN_PRODUCTO WHERE id_producto = (SELECT id FROM PRODUCTO WHERE nombre = 'Mono Tirantes de Lino'));
INSERT INTO PRODUCTO_SUCURSAL (id_producto, id_sucursal)
SELECT pr.id, s.id FROM PRODUCTO pr, SUCURSAL s
WHERE pr.nombre = 'Mono Tirantes de Lino' AND s.nombre IN ('RVRStyle', 'RVRStyle Beni', 'RVRStyle Sopocachi', 'RVRStyle Cala Cala')
ON CONFLICT DO NOTHING;
INSERT INTO INVENTARIO (id_almacen, id_variante_producto, stock_disponible)
SELECT a.id, v.id, 16
FROM VARIANTE_PRODUCTO v, ALMACEN a
WHERE v.sku IN ('MON02-BEI-S', 'MON02-BEI-M', 'MON02-BLA-S', 'MON02-BLA-M')
AND a.nombre IN ('Alma001', 'Alma001-S2', 'Almacén Sopocachi', 'Almacén Cala Cala')
ON CONFLICT (id_almacen, id_variante_producto) DO NOTHING;

-- MON03: Mono Corto Estampado
INSERT INTO PRODUCTO (id_categoria, nombre, descripcion, precio, descuento_porcentaje)
SELECT id, 'Mono Corto Estampado', 'Mono corto con estampado, escote cruzado y cintura elástica. Perfecto para el verano.', 240, 0
FROM CATEGORIA WHERE slug = 'monos'
AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE nombre = 'Mono Corto Estampado');
INSERT INTO VARIANTE_PRODUCTO (id_producto, sku, talla, color, corte)
SELECT pr.id, x.sku, x.talla, x.color, 'Corto'
FROM PRODUCTO pr, (VALUES
  ('MON03-FLZ-S', 'S', 'Floral Azul'),
  ('MON03-FLZ-M', 'M', 'Floral Azul'),
  ('MON03-MOS-S', 'S', 'Mostaza'),
  ('MON03-MOS-M', 'M', 'Mostaza')
) AS x(sku, talla, color)
WHERE pr.nombre = 'Mono Corto Estampado'
AND NOT EXISTS (SELECT 1 FROM VARIANTE_PRODUCTO WHERE sku = x.sku);
INSERT INTO IMAGEN_PRODUCTO (id_producto, url, es_principal, orden)
SELECT id, 'https://picsum.photos/seed/MON03/640/800', TRUE, 1
FROM PRODUCTO WHERE nombre = 'Mono Corto Estampado'
AND NOT EXISTS (SELECT 1 FROM IMAGEN_PRODUCTO WHERE id_producto = (SELECT id FROM PRODUCTO WHERE nombre = 'Mono Corto Estampado'));
INSERT INTO PRODUCTO_SUCURSAL (id_producto, id_sucursal)
SELECT pr.id, s.id FROM PRODUCTO pr, SUCURSAL s
WHERE pr.nombre = 'Mono Corto Estampado' AND s.nombre IN ('RVRStyle', 'RVRStyle Beni', 'RVRStyle Sopocachi')
ON CONFLICT DO NOTHING;
INSERT INTO INVENTARIO (id_almacen, id_variante_producto, stock_disponible)
SELECT a.id, v.id, 13
FROM VARIANTE_PRODUCTO v, ALMACEN a
WHERE v.sku IN ('MON03-FLZ-S', 'MON03-FLZ-M', 'MON03-MOS-S', 'MON03-MOS-M')
AND a.nombre IN ('Alma001', 'Alma001-S2', 'Almacén Sopocachi')
ON CONFLICT (id_almacen, id_variante_producto) DO NOTHING;
