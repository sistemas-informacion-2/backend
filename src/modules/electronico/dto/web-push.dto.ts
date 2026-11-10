import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, IsUrl, Matches, MaxLength, ValidateNested } from 'class-validator';

const BASE64_URL = /^[A-Za-z0-9_-]+={0,2}$/;

export class BajaWebPushDto {
  @IsString()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(1000)
  endpoint: string;
}

export class ClavesWebPushDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(BASE64_URL)
  p256dh: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(BASE64_URL)
  auth: string;
}

/** `endpoint` y `keys` de `PushSubscription.toJSON()` en el navegador. */
export class RegistrarWebPushDto extends BajaWebPushDto {
  @ValidateNested()
  @Type(() => ClavesWebPushDto)
  keys: ClavesWebPushDto;
}

export interface ConfiguracionWebPushDto {
  habilitado: boolean;
  clavePublica: string | null;
}
