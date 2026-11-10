import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import {
  CATEGORIAS_MANUALES,
  SUBCATEGORIAS_GASTO,
  type CategoriaMovimientoCaja,
  type SubcategoriaGasto,
  type TipoMovimientoCaja,
} from '../entities/movimiento-caja.entity.js';

export class CrearMovimientoCajaDto {
  @IsIn(['INGRESO', 'EGRESO'])
  tipo: TipoMovimientoCaja;

  /** Solo las manuales; que corresponda al tipo (un retiro no es un ingreso) lo valida CajaService. */
  @IsIn([...CATEGORIAS_MANUALES.INGRESO, ...CATEGORIAS_MANUALES.EGRESO])
  categoria: CategoriaMovimientoCaja;

  /** Obligatoria si la categoria es GASTO_OPERATIVO. */
  @IsOptional()
  @IsIn(SUBCATEGORIAS_GASTO)
  subcategoriaGasto?: SubcategoriaGasto;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  concepto: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}
