import { EXPO_PUSH_URL, PushService, type MensajePush } from './push.service.js';

function mensaje(n: number): MensajePush {
  return { token: `ExponentPushToken[${n}]`, titulo: 'Hola', mensaje: 'Cuerpo', data: { url: '/cuenta/notificaciones', idNotificacion: n } };
}

function respuestaOk(tickets: unknown[]) {
  return { ok: true, status: 200, json: async () => ({ data: tickets }), text: async () => '' };
}

function crearService(cfg: { enabled?: boolean; accessToken?: string } = {}) {
  const valores: Record<string, unknown> = { 'push.enabled': cfg.enabled ?? true, 'push.accessToken': cfg.accessToken ?? '' };
  const config = { get: (clave: string) => valores[clave] };
  const dispositivoRepo = { desactivarPorTokens: vi.fn().mockResolvedValue(undefined) };
  return { service: new PushService(config as never, dispositivoRepo as never), dispositivoRepo };
}

describe('PushService', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('deshabilitado no llama a Expo', async () => {
    const { service } = crearService({ enabled: false });

    await service.enviar([mensaje(1)]);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sin mensajes no llama a Expo', async () => {
    const { service } = crearService();

    await service.enviar([]);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envia el formato de Expo con sonido, canal y data, sin Authorization si no hay access token', async () => {
    fetchMock.mockResolvedValue(respuestaOk([{ status: 'ok', id: 't1' }]));
    const { service } = crearService();

    await service.enviar([mensaje(1)]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(EXPO_PUSH_URL);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual([
      {
        to: 'ExponentPushToken[1]',
        title: 'Hola',
        body: 'Cuerpo',
        sound: 'default',
        channelId: 'default',
        data: { url: '/cuenta/notificaciones', idNotificacion: 1 },
      },
    ]);
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('agrega Authorization cuando hay access token', async () => {
    fetchMock.mockResolvedValue(respuestaOk([{ status: 'ok' }]));
    const { service } = crearService({ accessToken: 'secreto' });

    await service.enviar([mensaje(1)]);

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer secreto');
  });

  it('parte los mensajes en lotes de 100', async () => {
    fetchMock.mockImplementation(async (_url: string, init: { body: string }) =>
      respuestaOk((JSON.parse(init.body) as unknown[]).map(() => ({ status: 'ok' }))),
    );
    const { service } = crearService();

    await service.enviar(Array.from({ length: 250 }, (_, i) => mensaje(i)));

    expect(fetchMock.mock.calls.map(([, init]) => (JSON.parse(init.body) as unknown[]).length)).toEqual([100, 100, 50]);
  });

  it('desactiva solo los tokens que Expo reporta como DeviceNotRegistered', async () => {
    fetchMock.mockResolvedValue(
      respuestaOk([
        { status: 'ok' },
        { status: 'error', message: 'no registrado', details: { error: 'DeviceNotRegistered' } },
        { status: 'error', message: 'muy grande', details: { error: 'MessageTooBig' } },
      ]),
    );
    const { service, dispositivoRepo } = crearService();

    await service.enviar([mensaje(1), mensaje(2), mensaje(3)]);

    expect(dispositivoRepo.desactivarPorTokens).toHaveBeenCalledWith(['ExponentPushToken[2]']);
  });

  it('un error de red o un 500 no lanza y sigue con el siguiente lote', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'boom', json: async () => ({}) });
    const { service, dispositivoRepo } = crearService();

    await expect(service.enviar(Array.from({ length: 150 }, (_, i) => mensaje(i)))).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(dispositivoRepo.desactivarPorTokens).not.toHaveBeenCalled();
  });
});
