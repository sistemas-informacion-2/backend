import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const PATRON_HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class CrearSucursalDto {
  @IsInt()
  idCiudad: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  ubicacion: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  correo?: string;

  @IsOptional()
  @IsString()
  @Matches(PATRON_HORA, { message: 'horarioApertura debe tener formato HH:mm' })
  horarioApertura?: string;

  @IsOptional()
  @IsString()
  @Matches(PATRON_HORA, { message: 'horarioCierre debe tener formato HH:mm' })
  horarioCierre?: string;
}
