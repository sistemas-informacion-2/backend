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
    modelo_3d_url VARCHAR(500),
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
    session_id VARCHAR(100),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_carrito_cliente FOREIGN KEY (id_cliente) REFERENCES CLIENTE(id_usuario) ON DELETE CASCADE
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