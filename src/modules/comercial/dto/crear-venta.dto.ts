import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ItemVentaDto } from './item-venta.dto.js';

export class CrearVentaDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idCliente: number;

  /** Obligatoria para el administrador; el cajero usa la sucursal de su token. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idSucursal?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  idAlmacen: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  idPasarela: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  descuento?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  impuesto?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  nitRazonSocial?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  nroFactura?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemVentaDto)
  items: ItemVentaDto[];
}
