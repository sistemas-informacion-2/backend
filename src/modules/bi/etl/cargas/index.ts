import type { CargaEtl } from './carga.js';
import { CARGA_DIM_ALMACEN, CARGA_DIM_CLIENTE, CARGA_DIM_PRODUCTO, CARGA_DIM_PROVEEDOR, CARGA_DIM_SUCURSAL } from './dimensiones.carga.js';
import { CARGA_FACT_GASTOS, CARGA_FACT_PAGOS, CARGA_FACT_RESERVAS } from './finanzas.carga.js';
import { CARGA_FACT_COMPRAS, CARGA_FACT_INVENTARIO_DIARIO, CARGA_FACT_MOVIMIENTOS } from './inventario.carga.js';
import { CARGA_FACT_DEVOLUCIONES, CARGA_FACT_VENTAS } from './ventas.carga.js';

/** En orden: primero las dimensiones (los hechos las referencian), sucursal antes que almacen. */
export const CARGAS_ETL: readonly CargaEtl[] = [
  CARGA_DIM_SUCURSAL,
  CARGA_DIM_ALMACEN,
  CARGA_DIM_PRODUCTO,
  CARGA_DIM_CLIENTE,
  CARGA_DIM_PROVEEDOR,
  CARGA_FACT_VENTAS,
  CARGA_FACT_DEVOLUCIONES,
  CARGA_FACT_COMPRAS,
  CARGA_FACT_MOVIMIENTOS,
  CARGA_FACT_INVENTARIO_DIARIO,
  CARGA_FACT_PAGOS,
  CARGA_FACT_GASTOS,
  CARGA_FACT_RESERVAS,
];
