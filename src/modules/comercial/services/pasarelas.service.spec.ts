import { BadRequestException, ConflictException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { PasarelasService } from './pasarelas.service.js';
import type { PasarelaPago } from '../entities/pasarela-pago.entity.js';

const ENCRYPTION_KEY = 'a'.repeat(64);

function pasarelaBase(overrides: Partial<PasarelaPago> = {}): PasarelaPago {
  return {
    id: 1,
    codigo: 'EFECTIVO',
    metodo: 'Efectivo',
    descripcion: null,
    integracion: 'NINGUNA',
    apiKeyEncriptada: null,
    comisionPorcentaje: '0.00',
    disponiblePresencial: true,
    disponibleLinea: false,
    ...overrides,
  };
}

function crearService(overrides: { pasarelaRepo?: Record<string, ReturnType<typeof vi.fn>> } = {}) {
  const pasarelaRepo = {
    findWithFilters: vi.fn(),
    findPresencial: vi.fn(),
    findLinea: vi.fn(),
    findById: vi.fn(),
    findByCodigo: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    ...overrides.pasarelaRepo,
  };
  const config = { get: vi.fn().mockReturnValue(ENCRYPTION_KEY) } as unknown as ConfigService;

  return {
    service: new PasarelasService(pasarelaRepo as never, config),
    pasarelaRepo,
  };
}

describe('PasarelasService', () => {
  it('crea un metodo normalizando el codigo a mayusculas y con canales por defecto en false', async () => {
    const pasarela = pasarelaBase({ codigo: 'QR', metodo: 'QR', disponiblePresencial: true, disponibleLinea: true });
    const { service, pasarelaRepo } = crearService({
      pasarelaRepo: {
        findByCodigo: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockReturnValue(pasarela),
        save: vi.fn().mockResolvedValue(pasarela),
      },
    });

    const response = await service.crear({
      codigo: ' qr ',
      metodo: ' QR ',
      integracion: 'NINGUNA',
      disponiblePresencial: true,
      disponibleLinea: true,
    });

    expect(pasarelaRepo.findByCodigo).toHaveBeenCalledWith('QR');
    expect(pasarelaRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        codigo: 'QR',
        metodo: 'QR',
        integracion: 'NINGUNA',
        apiKeyEncriptada: null,
        disponiblePresencial: true,
        disponibleLinea: true,
      }),
    );
    expect(response.codigo).toBe('QR');
    expect(response.disponiblePresencial).toBe(true);
  });

  it('rechaza crear un metodo con codigo duplicado', async () => {
    const { service, pasarelaRepo } = crearService({
      pasarelaRepo: { findByCodigo: vi.fn().mockResolvedValue(pasarelaBase()) },
    });

    await expect(
      service.crear({ codigo: 'EFECTIVO', metodo: 'Efectivo', integracion: 'NINGUNA' }),
    ).rejects.toThrow(ConflictException);
    expect(pasarelaRepo.save).not.toHaveBeenCalled();
  });

  it('no permite habilitar un canal de un metodo API sin credenciales', async () => {
    const { service, pasarelaRepo } = crearService({
      pasarelaRepo: { findByCodigo: vi.fn().mockResolvedValue(null) },
    });

    await expect(
      service.crear({ codigo: 'PAYPAL', metodo: 'PayPal', integracion: 'API', disponibleLinea: true }),
    ).rejects.toThrow(BadRequestException);
    expect(pasarelaRepo.save).not.toHaveBeenCalled();
  });

  it('cifra las credenciales al crear un metodo API con canal habilitado', async () => {
    const pasarela = pasarelaBase({
      codigo: 'PAYPAL',
      integracion: 'API',
      apiKeyEncriptada: 'cifrado',
      disponiblePresencial: false,
      disponibleLinea: true,
    });
    const { service, pasarelaRepo } = crearService({
      pasarelaRepo: {
        findByCodigo: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockReturnValue(pasarela),
        save: vi.fn().mockResolvedValue(pasarela),
      },
    });

    const response = await service.crear({
      codigo: 'PAYPAL',
      metodo: 'PayPal',
      integracion: 'API',
      disponibleLinea: true,
      apiKey: 'client-id',
      apiSecret: 'client-secret',
    });

    const datos = pasarelaRepo.create.mock.calls[0][0] as PasarelaPago;
    expect(datos.apiKeyEncriptada).toBeTruthy();
    expect(datos.apiKeyEncriptada).not.toContain('client-secret');
    expect(response.tieneApiKey).toBe(true);
    expect(response.origenCredenciales).toBe('PANEL');
  });

  it('no permite habilitar por canal un metodo API sin credenciales', async () => {
    const { service, pasarelaRepo } = crearService({
      pasarelaRepo: {
        findById: vi.fn().mockResolvedValue(
          pasarelaBase({ codigo: 'PAYPAL', integracion: 'API', apiKeyEncriptada: null, disponibleLinea: false }),
        ),
      },
    });

    await expect(service.cambiarDisponibilidad(1, { linea: true })).rejects.toThrow(ConflictException);
    expect(pasarelaRepo.save).not.toHaveBeenCalled();
  });

  it('habilita un canal de un metodo sin integracion API', async () => {
    const pasarela = pasarelaBase({ disponiblePresencial: false, disponibleLinea: false });
    const { service } = crearService({
      pasarelaRepo: {
        findById: vi.fn().mockResolvedValue(pasarela),
        save: vi.fn().mockResolvedValue(pasarela),
      },
    });

    const response = await service.cambiarDisponibilidad(1, { presencial: true });

    expect(pasarela.disponiblePresencial).toBe(true);
    expect(pasarela.disponibleLinea).toBe(false);
    expect(response.disponiblePresencial).toBe(true);
  });
});
