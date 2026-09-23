import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BajaDispositivoPushDto, RegistrarDispositivoPushDto } from './dispositivo-push.dto.js';

async function erroresRegistro(datos: Record<string, unknown>): Promise<string[]> {
  return (await validate(plainToInstance(RegistrarDispositivoPushDto, datos))).map((error) => error.property);
}

describe('RegistrarDispositivoPushDto', () => {
  it('acepta los dos formatos de token de Expo en android e ios', async () => {
    expect(await erroresRegistro({ token: 'ExponentPushToken[abc123]', plataforma: 'android' })).toEqual([]);
    expect(await erroresRegistro({ token: 'ExpoPushToken[abc123]', plataforma: 'ios' })).toEqual([]);
  });

  it('rechaza tokens que no son de Expo, vacios o demasiado largos', async () => {
    expect(await erroresRegistro({ token: 'abc', plataforma: 'android' })).toEqual(['token']);
    expect(await erroresRegistro({ token: 'ExponentPushToken[]', plataforma: 'android' })).toEqual(['token']);
    expect(await erroresRegistro({ token: `ExponentPushToken[${'x'.repeat(300)}]`, plataforma: 'android' })).toEqual(['token']);
  });

  it('rechaza una plataforma desconocida', async () => {
    expect(await erroresRegistro({ token: 'ExponentPushToken[abc]', plataforma: 'web' })).toEqual(['plataforma']);
  });
});

describe('BajaDispositivoPushDto', () => {
  it('exige un token de Expo valido', async () => {
    expect(await validate(plainToInstance(BajaDispositivoPushDto, { token: 'ExponentPushToken[abc]' }))).toEqual([]);
    const errores = await validate(plainToInstance(BajaDispositivoPushDto, {}));
    expect(errores.map((error) => error.property)).toEqual(['token']);
  });
});
