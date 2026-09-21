import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type {
  StockCriticoItemDto,
  TendenciaVentaDto,
  TopVarianteDto,
  VentasDiaDto,
  VentasSucursalDto,
} from '../dto/dashboard-resumen-response.dto.js';

const LIMITE_STOCK_CRITICO = 10;
const LIMITE_TOP_VARIANTES = 5;

/**
 * Agregaciones de solo lectura del dashboard. Se usa SQL directo porque las
 * tablas de ventas (NOTA_VENTA / DETALLE_NOTA_VENTA) pertenecen a CU13 y no
 * tienen entidad todavia; asi el dashboard funciona antes y despues de CU13.
 * Los casts `::float8` / `::int` evitan que Postgres devuelva NUMERIC y BIGINT como string.
 */
@Injectable()
export class DashboardRepository {
  constructor(private readonly dataSource: DataSource) {}

  async tablasVentasExisten(): Promise<boolean> {
    const [fila] = await this.dataSource.query<Array<{ existen: boolean }>>(
      `SELECT to_regclass('public.nota_venta') IS NOT NULL
          AND to_regclass('public.detalle_nota_venta') IS NOT NULL AS existen`,
    );
    return fila?.existen === true;
  }

  async ventasDelDia(idSucursal: number | null): Promise<Pick<VentasDiaDto, 'total' | 'cantidadNotas'>> {
    const [fila] = await this.dataSource.query<Array<{ total: number; cantidad: number }>>(
      `SELECT COALESCE(SUM(monto_total), 0)::float8 AS total, COUNT(*)::int AS cantidad
         FROM nota_venta
        WHERE fecha_emision = CURRENT_DATE
          AND ($1::int IS NULL OR id_sucursal = $1)`,
      [idSucursal],
    );
    return { total: fila?.total ?? 0, cantidadNotas: fila?.cantidad ?? 0 };
  }

  async contarCajasAbiertas(idSucursal: number | null): Promise<number> {
    const [fila] = await this.dataSource.query<Array<{ total: number }>>(
      `SELECT COUNT(*)::int AS total
         FROM caja
        WHERE estado = 'Abierta'
          AND ($1::int IS NULL OR id_sucursal = $1)`,
      [idSucursal],
    );
    return fila?.total ?? 0;
  }

  async contarStockCritico(idSucursal: number | null): Promise<number> {
    const [fila] = await this.dataSource.query<Array<{ total: number }>>(
      `SELECT COUNT(*)::int AS total
         FROM inventario i
         JOIN almacen a ON a.id = i.id_almacen
        WHERE i.stock_disponible <= i.stock_minimo
          AND ($1::int IS NULL OR a.id_sucursal = $1)`,
      [idSucursal],
    );
    return fila?.total ?? 0;
  }

  async listarStockCritico(idSucursal: number | null): Promise<StockCriticoItemDto[]> {
    const filas = await this.dataSource.query<
      Array<{
        id: number;
        id_sucursal: number;
        sucursal: string;
        almacen: string;
        producto: string;
        sku: string;
        talla: string;
        color: string;
        stock_disponible: number;
        stock_minimo: number;
      }>
    >(
      `SELECT i.id, s.id AS id_sucursal, s.nombre AS sucursal, a.nombre AS almacen,
              p.nombre AS producto, v.sku, v.talla, v.color,
              i.stock_disponible, i.stock_minimo
         FROM inventario i
         JOIN almacen a ON a.id = i.id_almacen
         JOIN sucursal s ON s.id = a.id_sucursal
         JOIN variante_producto v ON v.id = i.id_variante_producto
         JOIN producto p ON p.id = v.id_producto
        WHERE i.stock_disponible <= i.stock_minimo
          AND ($1::int IS NULL OR a.id_sucursal = $1)
        ORDER BY (i.stock_disponible - i.stock_minimo) ASC, p.nombre ASC
        LIMIT ${LIMITE_STOCK_CRITICO}`,
      [idSucursal],
    );
    return filas.map((fila) => ({
      idInventario: fila.id,
      idSucursal: fila.id_sucursal,
      sucursal: fila.sucursal,
      almacen: fila.almacen,
      producto: fila.producto,
      sku: fila.sku,
      talla: fila.talla,
      color: fila.color,
      stockDisponible: fila.stock_disponible,
      stockMinimo: fila.stock_minimo,
    }));
  }

  async topVariantes(idSucursal: number | null, dias: number): Promise<TopVarianteDto[]> {
    const filas = await this.dataSource.query<
      Array<{ id: number; sku: string; producto: string; talla: string; color: string; cantidad: number }>
    >(
      `SELECT v.id, v.sku, p.nombre AS producto, v.talla, v.color, SUM(d.cantidad)::int AS cantidad
         FROM detalle_nota_venta d
         JOIN nota_venta n ON n.id = d.id_nota_venta
         JOIN variante_producto v ON v.id = d.id_variante_producto
         JOIN producto p ON p.id = v.id_producto
        WHERE n.fecha_emision >= CURRENT_DATE - ($1::int - 1)
          AND ($2::int IS NULL OR n.id_sucursal = $2)
        GROUP BY v.id, v.sku, p.nombre, v.talla, v.color
        ORDER BY cantidad DESC, p.nombre ASC
        LIMIT ${LIMITE_TOP_VARIANTES}`,
      [dias, idSucursal],
    );
    return filas.map((fila) => ({
      idVariante: fila.id,
      sku: fila.sku,
      producto: fila.producto,
      talla: fila.talla,
      color: fila.color,
      cantidadVendida: fila.cantidad,
    }));
  }

  /** Comparativo entre todas las sucursales activas; no se filtra por sucursal a proposito. */
  async ventasPorSucursal(dias: number): Promise<VentasSucursalDto[]> {
    const filas = await this.dataSource.query<Array<{ id: number; nombre: string; total: number; cantidad: number }>>(
      `SELECT s.id, s.nombre, COALESCE(SUM(n.monto_total), 0)::float8 AS total, COUNT(n.id)::int AS cantidad
         FROM sucursal s
         LEFT JOIN nota_venta n
                ON n.id_sucursal = s.id
               AND n.fecha_emision >= CURRENT_DATE - ($1::int - 1)
        WHERE s.activo = true
        GROUP BY s.id, s.nombre
        ORDER BY total DESC, s.nombre ASC`,
      [dias],
    );
    return filas.map((fila) => ({
      idSucursal: fila.id,
      sucursal: fila.nombre,
      total: fila.total,
      cantidadNotas: fila.cantidad,
    }));
  }

  /** Un punto por dia de la ventana (los dias sin ventas van en 0 para no cortar la linea). */
  async tendenciaVentas(idSucursal: number | null, dias: number): Promise<TendenciaVentaDto[]> {
    return this.dataSource.query<TendenciaVentaDto[]>(
      `SELECT to_char(d.dia, 'YYYY-MM-DD') AS fecha, COALESCE(SUM(n.monto_total), 0)::float8 AS total
         FROM generate_series(CURRENT_DATE - ($1::int - 1), CURRENT_DATE, interval '1 day') AS d(dia)
         LEFT JOIN nota_venta n
                ON n.fecha_emision = d.dia::date
               AND ($2::int IS NULL OR n.id_sucursal = $2)
        GROUP BY d.dia
        ORDER BY d.dia`,
      [dias, idSucursal],
    );
  }
}
