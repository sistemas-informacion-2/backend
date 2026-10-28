import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export type CodigoMetodoOnline = 'QR' | 'STRIPE' | 'TARJETA';

export class MetodoPagoOnlineDto {
  id: number;
  codigo: CodigoMetodoOnline;
  metodo: string;
  descripcion: string | null;
  /** true cuando el metodo no tiene pasarela real y el pago se aprueba en simulacion (solo demostracion). */
  simulado: boolean;
}

export class ConfirmarStripeDto {
  /** Id de la sesion de Stripe Checkout: llega en el parametro `session_id` al volver de Stripe. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(/^cs_(test|live)_[A-Za-z0-9]+$/)
  sessionId: string;
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

export class IniciarStripeResponseDto {
  sessionId: string;
  /** Pagina de Stripe Checkout a la que hay que enviar al cliente para que autorice el cobro. */
  urlPago: string;
  montoBob: number;
  /** Lo que Stripe cobrara, en `monedaCobro` (no opera con el total en Bs). */
  montoCobrado: number;
  monedaCobro: string;
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
