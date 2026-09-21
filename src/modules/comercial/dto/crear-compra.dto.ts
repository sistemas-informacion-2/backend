import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CrearDetalleCompraDto {
  @IsInt()
  @Min(1)
  idVarianteProducto: number;

  /** Almacen de destino; debe ser de la sucursal de la compra. */
  @IsInt()
  @Min(1)
  idAlmacen: number;

  @IsInt()
  @Min(1)
  @Max(100000)
  cantidad: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precioUnitario: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  nroLote?: string;
}

export class CrearCompraDto {
  @IsInt()
  @Min(1)
  idProveedor: number;

  @IsInt()
  @Min(1)
  idSucursal: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  nroFactura?: string;

  @IsOptional()
  @IsDateString()
  fechaEntregaProgramada?: string;

  /** Si es true, se registra un egreso en la caja abierta de la sucursal por el total de la compra. */
  @IsOptional()
  @IsBoolean()
  pagarEnCaja?: boolean;

  @IsArray()
  @ArrayMinSize(1, { message: 'La compra debe tener al menos un item' })
  @ValidateNested({ each: true })
  @Type(() => CrearDetalleCompraDto)
  detalles: CrearDetalleCompraDto[];
}
