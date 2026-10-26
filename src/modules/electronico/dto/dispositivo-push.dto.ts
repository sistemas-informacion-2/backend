import { IsIn, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import type { PlataformaPush } from '../entities/dispositivo-push.entity.js';

/** Formato de los tokens de Expo: ExponentPushToken[...] o ExpoPushToken[...]. */
export const FORMATO_TOKEN_EXPO = /^Expo(nent)?PushToken\[.+\]$/;
export const PLATAFORMAS_PUSH: PlataformaPush[] = ['android', 'ios'];

export class BajaDispositivoPushDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(FORMATO_TOKEN_EXPO, { message: 'El token de notificaciones no es valido' })
  token: string;
}

export class RegistrarDispositivoPushDto extends BajaDispositivoPushDto {
  @IsIn(PLATAFORMAS_PUSH)
  plataforma: PlataformaPush;
}
