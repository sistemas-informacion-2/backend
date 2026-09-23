export class ProveedorResponseDto {
  id: number;
  empresa: string;
  nit: string;
  nombreContacto: string | null;
  telefonoContacto: string | null;
  correoContacto: string | null;
  activo: boolean;
}
