import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export type CodigoMetodoOnline = 'QR' | 'PAYPAL' | 'TARJETA';

export class MetodoPagoOnlineDto {
  id: number;
  codigo: CodigoMetodoOnline;
  metodo: string;
  descripcion: string | null;
  /** true cuando el metodo no tiene pasarela real y el pago se aprueba en simulacion (solo demostracion). */
  simulado: boolean;
}

export class CapturarPaypalDto {
  /** Id de la orden de PayPal: llega en el parametro `token` al volver de PayPal. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]+$/)
  orderId: string;
}

export class ConfirmarQrDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(400)
  referencia: string;
}

export class PagoTarjetaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  titular: string;

  /** 13 a 19 digitos, con o sin espacios. Nunca se guarda. */
  @IsString()
  @Matches(/^[\d ]{13,23}$/, { message: 'El numero de tarjeta debe tener entre 13 y 19 digitos' })
  numero: string;

  @IsString()
  @Matches(/^(0[1-9]|1[0-2])\/\d{2}$/, { message: 'El vencimiento debe tener el formato MM/AA' })
  vencimiento: string;

  @IsString()
  @Matches(/^\d{3,4}$/, { message: 'El CVV debe tener 3 o 4 digitos' })
  cvv: string;
}

export class IniciarPaypalResponseDto {
  orderId: string;
  /** Pagina de PayPal a la que hay que enviar al cliente para que apruebe el cobro. */
  urlAprobacion: string;
  montoBob: number;
  montoPaypal: number;
  monedaPaypal: string;
}

export class IniciarQrResponseDto {
  /** Token firmado; es lo que codifica el QR y lo que se envia al confirmar. */
  referencia: string;
  montoBob: number;
  expiraEn: string;
}

/** Resultado de un pago en linea: una compra del carrito o el anticipo de una reserva. */
export class CompraOnlineResponseDto {
  tipo: 'COMPRA' | 'ANTICIPO_RESERVA';
  idNotaVenta: number | null;
  codigoNota: string | null;
  idReserva: number | null;
  codigoReserva: string | null;
  /** Lo que se cobro: el total de la compra o el anticipo. */
  montoTotal: number;
  metodo: string;
}
