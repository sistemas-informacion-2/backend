import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { IngresoService } from './ingreso.service.js';

const hashCorrecto = bcrypt.hashSync('Clave123', 4);
const hashOtro = bcrypt.hashSync('OtraClave9', 4);

function cuenta(slug: string, nombre: string, passwordHash: string, extra: Record<string, unknown> = {}) {
  return {
    tipoUsuario: 'A',
    estadoAcceso: 'HABILITADO',
    passwordHash,
    empresa: { slug, nombre, logoUrl: null, estado: 'ACTIVA' },
    ...extra,
  };
}

function crear(cuentas: unknown[]) {
  const repo = { find: vi.fn(async () => cuentas) };
  return new IngresoService({ getRepository: () => repo } as never);
}

describe('IngresoService.tiendas', () => {
  it('devuelve solo las tiendas donde la contrasena es correcta, ordenadas por nombre', async () => {
    const service = crear([
      cuenta('zeta', 'Zeta Moda', hashCorrecto),
      cuenta('otra', 'Otra Clave', hashOtro),
      cuenta('alfa', 'Alfa Ropa', hashCorrecto, { tipoUsuario: 'E' }),
    ]);

    const tiendas = await service.tiendas({ email: 'carla@modaandina.bo', password: 'Clave123' }, null);

    expect(tiendas.map((t) => t.slug)).toEqual(['alfa', 'zeta']);
    expect(tiendas[0].tipoUsuario).toBe('E');
  });

  it('no lista tiendas suspendidas ni cuentas suspendidas', async () => {
    const service = crear([
      cuenta('suspendida', 'Suspendida', hashCorrecto, { empresa: { slug: 'suspendida', nombre: 'S', logoUrl: null, estado: 'SUSPENDIDA' } }),
      cuenta('cuenta-suspendida', 'Cuenta', hashCorrecto, { estadoAcceso: 'SUSPENDIDO' }),
    ]);

    await expect(service.tiendas({ email: 'a@b.bo', password: 'Clave123' }, null)).rejects.toThrow(UnauthorizedException);
  });

  it('responde el mismo error si el correo no existe o la contrasena no coincide', async () => {
    await expect(crear([]).tiendas({ email: 'nadie@b.bo', password: 'Clave123' }, null)).rejects.toThrow('Correo o contraseña incorrectos');
    await expect(crear([cuenta('x', 'X', hashOtro)]).tiendas({ email: 'a@b.bo', password: 'Clave123' }, null)).rejects.toThrow('Correo o contraseña incorrectos');
  });

  it('limita los intentos por IP', async () => {
    const service = crear([]);
    for (let intento = 0; intento < 10; intento++) {
      await service.tiendas({ email: 'a@b.bo', password: 'x' }, '9.9.9.9').catch(() => undefined);
    }

    await expect(service.tiendas({ email: 'a@b.bo', password: 'x' }, '9.9.9.9')).rejects.toThrow('Demasiados intentos');
  });
});
