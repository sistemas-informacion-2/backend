import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Stock que un cliente puede comprar en linea. El catalogo es global, pero el stock vive en los
 * almacenes de cada sucursal, asi que una variante solo cuenta en los almacenes activos de las
 * sucursales activas donde su producto esta activado (PRODUCTO_SUCURSAL).
 */
@Injectable()
export class DisponibilidadService {
  constructor(private readonly dataSource: DataSource) {}

  /** Devuelve un mapa idVariante -> unidades; las variantes sin stock vendible no aparecen (equivalen a 0). */
  async stockPorVariante(idsVariante: number[]): Promise<Map<number, number>> {
    if (idsVariante.length === 0) return new Map();

    const filas = await this.dataSource.query<Array<{ id_variante: number; stock: number }>>(
      `SELECT i.id_variante_producto AS id_variante, COALESCE(SUM(i.stock_disponible), 0)::int AS stock
         FROM inventario i
         JOIN almacen a ON a.id = i.id_almacen
         JOIN sucursal s ON s.id = a.id_sucursal
         JOIN variante_producto v ON v.id = i.id_variante_producto
         JOIN producto_sucursal ps
           ON ps.id_producto = v.id_producto AND ps.id_sucursal = a.id_sucursal AND ps.activo = true
        WHERE i.id_variante_producto = ANY($1::int[])
          AND a.activo = true
          AND s.activo = true
        GROUP BY i.id_variante_producto`,
      [idsVariante],
    );

    return new Map(filas.map((fila) => [fila.id_variante, fila.stock]));
  }
}
