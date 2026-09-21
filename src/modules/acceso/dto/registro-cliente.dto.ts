import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Autoregistro publico de un cliente desde la tienda. Nunca crea personal: el tipo de usuario lo fija el servidor. */
const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class RegistroClienteDto {
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  apellido: string;

  @Transform(recortar)
  @IsEmail()
  @MaxLength(150)
  email: string;

  @IsOptional()
  @IsString()
  @Matches(/^[\d +()-]{6,20}$/, { message: 'El telefono solo admite numeros, espacios, + ( ) y -' })
  telefono?: string;

  /** 72 es el maximo que bcrypt procesa; mas alla los caracteres se ignorarian en silencio. */
  @IsString()
  @MinLength(8, { message: 'La contrasena debe tener al menos 8 caracteres' })
  @MaxLength(72)
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, { message: 'La contrasena debe combinar letras y numeros' })
  password: string;
}
