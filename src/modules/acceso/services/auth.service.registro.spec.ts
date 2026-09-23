import { ConflictException, HttpException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AuthService } from './auth.service.js';
import { RegistroClienteDto } from '../dto/registro-cliente.dto.js';

const dtoValido = { nombre: 'Ana', apellido: 'Perez', email: '  Ana@Correo.COM ', telefono: '70012345', password: 'Clave1234' };

function crearService() {
  const clientesService = { crear: vi.fn().mockResolvedValue({ id: 7 }) };
  const service = new AuthService({} as never, {} as never, clientesService as never, {} as never, {} as never, {} as never, {} as never);
  const sesion = { accessToken: 'a', refreshToken: 'r', perfil: { id: 7, tipoUsuario: 'C' } };
  const login = vi.spyOn(service, 'login').mockResolvedValue(sesion as never);
  return { service, clientesService, login, sesion };
}

describe('AuthService.registrarCliente', () => {
  it('crea el cliente con el correo normalizado e inicia sesion', async () => {
    const { service, clientesService, login, sesion } = crearService();

    const respuesta = await service.registrarCliente(dtoValido, '1.1.1.1', 'jest');

    expect(clientesService.crear).toHaveBeenCalledWith({
      nombre: 'Ana',
      apellido: 'Perez',
      email: 'ana@correo.com',
      telefono: '70012345',
      password: 'Clave1234',
    });
    expect(login).toHaveBeenCalledWith({ email: 'ana@correo.com', password: 'Clave1234' }, '1.1.1.1', 'jest');
    expect(respuesta).toBe(sesion);
  });

  it('no inicia sesion si el correo ya esta registrado', async () => {
    const { service, clientesService, login } = crearService();
    clientesService.crear.mockRejectedValue(new ConflictException('El email ya está registrado'));

    await expect(service.registrarCliente(dtoValido, '1.1.1.1', null)).rejects.toThrow(ConflictException);
    expect(login).not.toHaveBeenCalled();
  });

  it('limita los registros por direccion IP', async () => {
    const { service, clientesService } = crearService();

    for (let i = 0; i < 10; i += 1) await service.registrarCliente(dtoValido, '2.2.2.2', null);

    const excedido = service.registrarCliente(dtoValido, '2.2.2.2', null);
    await expect(excedido).rejects.toThrow(HttpException);
    await expect(excedido).rejects.toMatchObject({ status: 429 });
    expect(clientesService.crear).toHaveBeenCalledTimes(10);

    await expect(service.registrarCliente(dtoValido, '3.3.3.3', null)).resolves.toBeDefined();
  });

  it('el limite se libera pasada una hora', async () => {
    const { service } = crearService();
    for (let i = 0; i < 10; i += 1) await service.registrarCliente(dtoValido, '4.4.4.4', null);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 61 * 60 * 1000);
    await expect(service.registrarCliente(dtoValido, '4.4.4.4', null)).resolves.toBeDefined();
    vi.useRealTimers();
  });
});

describe('RegistroClienteDto', () => {
  const errores = async (datos: Record<string, unknown>) =>
    (await validate(plainToInstance(RegistroClienteDto, { ...dtoValido, ...datos }))).map((error) => error.property);

  it('acepta un registro correcto', async () => {
    expect(await errores({})).toEqual([]);
  });

  it('exige contrasena de 8+ caracteres con letras y numeros', async () => {
    expect(await errores({ password: 'corta1' })).toContain('password');
    expect(await errores({ password: 'sololetrasaqui' })).toContain('password');
    expect(await errores({ password: '1234567890' })).toContain('password');
  });

  it('rechaza correo invalido y telefono con letras', async () => {
    expect(await errores({ email: 'no-es-correo' })).toContain('email');
    expect(await errores({ telefono: 'abc' })).toContain('telefono');
  });

  it('el telefono es opcional', async () => {
    expect(await errores({ telefono: undefined })).toEqual([]);
  });
});
