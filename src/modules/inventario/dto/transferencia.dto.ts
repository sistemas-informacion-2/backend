import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class TransferirStockDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idAlmacenOrigen: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  idAlmacenDestino: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  idVarianteProducto: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidad: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  motivo?: string;
}

export interface TransferenciaResponseDto {
  id: number;
  almacenOrigen: { id: number; nombre: string; sucursal: string };
  almacenDestino: { id: number; nombre: string; sucursal: string };
  idVarianteProducto: number;
  sku: string;
  productoNombre: string;
  cantidad: number;
  motivo: string | null;
  idUsuario: number | null;
  fechaHora: Date;
}
