import type { CargaEtl } from './carga.js';

/**
 * Dimensiones: se insertan o se actualizan (tipo 1), nunca se borran. Asi una venta vieja sigue apuntando a su
 * producto aunque hoy este inactivo. `$1` = id de la empresa.
 */

export const CARGA_DIM_SUCURSAL: CargaEtl = {
  tabla: 'dim_sucursal',
  tipo: 'DIMENSION',
  sql: `
    INSERT INTO dw.dim_sucursal (id_sucursal, id_empresa, nombre, ciudad, departamento, activo, actualizado_en)
    SELECT s.id, s.id_empresa, s.nombre, c.nombre, d.nombre, s.activo, now()
      FROM sucursal s
      LEFT JOIN ciudad c ON c.id = s.id_ciudad
      LEFT JOIN departamento d ON d.id = c.id_departamento
     WHERE s.id_empresa = $1
    ON CONFLICT (id_sucursal) DO UPDATE SET
      nombre = EXCLUDED.nombre, ciudad = EXCLUDED.ciudad, departamento = EXCLUDED.departamento,
      activo = EXCLUDED.activo, actualizado_en = EXCLUDED.actualizado_en`,
};

export const CARGA_DIM_ALMACEN: CargaEtl = {
  tabla: 'dim_almacen',
  tipo: 'DIMENSION',
  sql: `
    INSERT INTO dw.dim_almacen (id_almacen, id_empresa, id_sucursal, nombre, activo, actualizado_en)
    SELECT a.id, a.id_empresa, a.id_sucursal, a.nombre, a.activo, now()
      FROM almacen a
     WHERE a.id_empresa = $1
    ON CONFLICT (id_almacen) DO UPDATE SET
      id_sucursal = EXCLUDED.id_sucursal, nombre = EXCLUDED.nombre, activo = EXCLUDED.activo, actualizado_en = EXCLUDED.actualizado_en`,
};

export const CARGA_DIM_PRODUCTO: CargaEtl = {
  tabla: 'dim_producto',
  tipo: 'DIMENSION',
  sql: `
    INSERT INTO dw.dim_producto (id_variante, id_empresa, sku, talla, color, corte, id_producto, producto, id_categoria, categoria,
                                 categoria_padre, precio_actual, descuento_actual, costo_promedio_actual, activo, actualizado_en)
    SELECT v.id, v.id_empresa, v.sku, v.talla, v.color, v.corte, p.id, p.nombre, cat.id, cat.nombre,
           padre.nombre, p.precio, COALESCE(p.descuento_porcentaje, 0), v.costo_promedio, (v.activo AND p.activo), now()
      FROM variante_producto v
      JOIN producto p ON p.id = v.id_producto
      LEFT JOIN categoria cat ON cat.id = p.id_categoria
      LEFT JOIN categoria padre ON padre.id = cat.id_categoria_padre
     WHERE v.id_empresa = $1
    ON CONFLICT (id_variante) DO UPDATE SET
      sku = EXCLUDED.sku, talla = EXCLUDED.talla, color = EXCLUDED.color, corte = EXCLUDED.corte, id_producto = EXCLUDED.id_producto,
      producto = EXCLUDED.producto, id_categoria = EXCLUDED.id_categoria, categoria = EXCLUDED.categoria,
      categoria_padre = EXCLUDED.categoria_padre, precio_actual = EXCLUDED.precio_actual, descuento_actual = EXCLUDED.descuento_actual,
      costo_promedio_actual = EXCLUDED.costo_promedio_actual, activo = EXCLUDED.activo, actualizado_en = EXCLUDED.actualizado_en`,
};

/**
 * Clientes de la empresa, y ademas cualquier usuario de la empresa que figure como cliente en una venta, reserva o
 * devolucion aunque le falte su ficha de cliente (datos viejos): asi ningun hecho queda sin su dimension.
 */
export const CARGA_DIM_CLIENTE: CargaEtl = {
  tabla: 'dim_cliente',
  tipo: 'DIMENSION',
  sql: `
    INSERT INTO dw.dim_cliente (id_cliente, id_empresa, nombre, sexo, ciudad, fecha_alta, es_consumidor_final, actualizado_en)
    SELECT u.id, u.id_empresa, TRIM(COALESCE(u.nombre, '') || ' ' || COALESCE(u.apellido, '')), u.sexo, c.ciudad_residencia,
           u.fecha_creacion::date, COALESCE(c.es_consumidor_final, false), now()
      FROM usuario u
      LEFT JOIN cliente c ON c.id_usuario = u.id
     WHERE u.id_empresa = $1
       AND (c.id_usuario IS NOT NULL
            OR EXISTS (SELECT 1 FROM nota_venta nv WHERE nv.id_cliente = u.id)
            OR EXISTS (SELECT 1 FROM reserva r WHERE r.id_cliente = u.id)
            OR EXISTS (SELECT 1 FROM nota_devolucion nd WHERE nd.id_cliente = u.id))
    ON CONFLICT (id_cliente) DO UPDATE SET
      nombre = EXCLUDED.nombre, sexo = EXCLUDED.sexo, ciudad = EXCLUDED.ciudad, fecha_alta = EXCLUDED.fecha_alta,
      es_consumidor_final = EXCLUDED.es_consumidor_final, actualizado_en = EXCLUDED.actualizado_en`,
};

export const CARGA_DIM_PROVEEDOR: CargaEtl = {
  tabla: 'dim_proveedor',
  tipo: 'DIMENSION',
  sql: `
    INSERT INTO dw.dim_proveedor (id_proveedor, id_empresa, nombre, nit, activo, actualizado_en)
    SELECT p.id, p.id_empresa, p.empresa, p.nit, p.activo, now()
      FROM proveedor p
     WHERE p.id_empresa = $1
    ON CONFLICT (id_proveedor) DO UPDATE SET
      nombre = EXCLUDED.nombre, nit = EXCLUDED.nit, activo = EXCLUDED.activo, actualizado_en = EXCLUDED.actualizado_en`,
};
