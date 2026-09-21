export class VentasDiaDto {
  total: number;
  cantidadNotas: number;
  ticketPromedio: number;
}

export class StockCriticoItemDto {
  idInventario: number;
  idSucursal: number;
  sucursal: string;
  almacen: string;
  producto: string;
  sku: string;
  talla: string;
  color: string;
  stockDisponible: number;
  stockMinimo: number;
}

export class StockCriticoDto {
  total: number;
  items: StockCriticoItemDto[];
}

export class TopVarianteDto {
  idVariante: number;
  sku: string;
  producto: string;
  talla: string;
  color: string;
  cantidadVendida: number;
}

export class VentasSucursalDto {
  idSucursal: number;
  sucursal: string;
  total: number;
  cantidadNotas: number;
}

export class TendenciaVentaDto {
  fecha: string;
  total: number;
}

export class DashboardResumenResponseDto {
  fecha: string;
  idSucursal: number | null;
  dias: number;
  /** false cuando las tablas de ventas (CU13) aun no existen en la base de datos. */
  ventasDisponibles: boolean;
  ventasDia: VentasDiaDto;
  cajasAbiertas: number;
  stockCritico: StockCriticoDto;
  topVariantes: TopVarianteDto[];
  ventasPorSucursal: VentasSucursalDto[];
  tendenciaVentas: TendenciaVentaDto[];
}
