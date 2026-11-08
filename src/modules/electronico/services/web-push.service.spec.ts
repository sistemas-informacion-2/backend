import webpush from 'web-push';
import { esEndpointDePush, WebPushService, type MensajeWebPush } from './web-push.service.js';

vi.mock('web-push', () => ({ default: { sendNotification: vi.fn() } }));

const enviarMock = vi.mocked(webpush.sendNotification);

function preparar(claves = { publicKey: 'PUB', privateKey: 'PRIV', subject: 'mailto:a@b.com' }) {
  const repo = { eliminarPorEndpoints: vi.fn().mockResolvedValue(undefined) };
  return { service: new WebPushService({ get: () => claves } as never, repo as never), repo };
}

const mensaje = (endpoint = 'https://fcm.googleapis.com/fcm/send/abc'): MensajeWebPush => ({
  suscripcion: { endpoint, p256dh: 'clave', auth: 'secreto' },
  titulo: 'Compra confirmada',
  mensaje: 'Recibimos tu pago',
  url: '/',
  etiqueta: 'notificacion-1',
});

describe('WebPushService', () => {
  beforeEach(() => {
    enviarMock.mockReset();
  });

  it('envia el aviso firmado con las claves VAPID', async () => {
    enviarMock.mockResolvedValue({} as never);
    const { service } = preparar();
    await expect(service.enviar([mensaje()])).resolves.toBe(1);
    const [suscripcion, carga, opciones] = enviarMock.mock.calls[0];
    expect(suscripcion.keys).toEqual({ p256dh: 'clave', auth: 'secreto' });
    expect(JSON.parse(carga as string)).toMatchObject({ titulo: 'Compra confirmada', url: '/', etiqueta: 'notificacion-1' });
    expect(opciones?.vapidDetails).toEqual({ subject: 'mailto:a@b.com', publicKey: 'PUB', privateKey: 'PRIV' });
  });

  it('borra las suscripciones vencidas (404 y 410)', async () => {
    enviarMock.mockRejectedValueOnce({ statusCode: 410 }).mockRejectedValueOnce({ statusCode: 404 }).mockResolvedValueOnce({} as never);
    const { service, repo } = preparar();
    await expect(service.enviar([mensaje('https://fcm.googleapis.com/a'), mensaje('https://fcm.googleapis.com/b'), mensaje('https://fcm.googleapis.com/c')])).resolves.toBe(1);
    expect(repo.eliminarPorEndpoints).toHaveBeenCalledWith(['https://fcm.googleapis.com/a', 'https://fcm.googleapis.com/b']);
  });

  it('un fallo pasajero no borra la suscripcion ni lanza', async () => {
    enviarMock.mockRejectedValue({ statusCode: 500 });
    const { service, repo } = preparar();
    await expect(service.enviar([mensaje()])).resolves.toBe(0);
    expect(repo.eliminarPorEndpoints).toHaveBeenCalledWith([]);
  });

  it('sin claves queda desactivado y no envia', async () => {
    const { service } = preparar({ publicKey: '', privateKey: '', subject: '' });
    expect(service.habilitado).toBe(false);
    expect(service.clavePublica).toBeNull();
    await expect(service.enviar([mensaje()])).resolves.toBe(0);
    expect(enviarMock).not.toHaveBeenCalled();
  });
});

describe('esEndpointDePush', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://wns2-ch1p.notify.windows.com/w/?token=abc',
    'https://web.push.apple.com/abc',
  ])('acepta %s', (url) => expect(esEndpointDePush(url)).toBe(true));

  it.each([
    'http://fcm.googleapis.com/fcm/send/abc',
    'https://169.254.169.254/latest/meta-data',
    'https://localhost:3000/api',
    'https://fcm.googleapis.com.atacante.com/x',
    'https://malnotify.windows.com.evil.com/x',
    'no-es-url',
  ])('rechaza %s', (url) => expect(esEndpointDePush(url)).toBe(false));
});
