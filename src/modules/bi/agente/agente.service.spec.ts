import { ConflictException, HttpException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { AgenteService } from './agente.service.js';
import { BiConversacion } from '../entities/bi-conversacion.entity.js';
import { BiMensaje } from '../entities/bi-mensaje.entity.js';
import type { ActiveUser } from '../../acceso/types/jwt-payload.type.js';

const usuario: ActiveUser = { sub: 9, tipoUsuario: 'A', permisos: [], jti: 'x', empresaId: 7 };

const pideHerramienta = (nombre = 'ventas_por_periodo', args: Record<string, unknown> = { desde: '2026-01-01' }) => ({
  functionCalls: [{ id: 'c1', name: nombre, args }],
  candidates: [{ content: { role: 'model', parts: [{ functionCall: { name: nombre, args }, thoughtSignature: 'firma' }] } }],
  usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 10, thoughtsTokenCount: 5 },
});
const responde = (text: string) => ({ text, usageMetadata: { promptTokenCount: 200, candidatesTokenCount: 20 } });

function crear(opciones: { ultimaCarga?: string | null; usadasHoy?: number; conversacion?: Partial<BiConversacion> | null; historial?: Array<Partial<BiMensaje>> } = {}) {
  const generar = vi.fn();
  const gemini = { generar, modelo: () => 'gemini-3.1-flash-lite', modo: () => 'API_KEY' };
  const ejecutar = vi.fn(async (nombre: string, parametros: Record<string, unknown>) => ({ nombre, parametros, ok: true, grafico: null, resultado: { filas: [{ a: 1 }] }, paraModelo: { filas: [{ a: 1 }], total_filas: 1 } }));
  const registro = { ejecutar, declaraciones: () => [{ name: 'ventas_por_periodo' }] };
  const guardados: { conversaciones: unknown[]; mensajes: Array<Record<string, unknown>> } = { conversaciones: [], mensajes: [] };
  const repoConversaciones = {
    create: vi.fn((d) => d),
    save: vi.fn(async (d) => {
      guardados.conversaciones.push(d);
      return { id: 55, ...d };
    }),
    update: vi.fn(),
  };
  const repoMensajes = {
    create: vi.fn((d) => d),
    save: vi.fn(async (d) => {
      guardados.mensajes.push(d);
      return d;
    }),
  };
  const manager = { getRepository: (e: unknown) => (e === BiConversacion ? repoConversaciones : repoMensajes) };
  const dataSource = {
    query: vi.fn(async () => [{ fin: opciones.ultimaCarga === undefined ? '2026-11-08 02:00' : opciones.ultimaCarga }]),
    transaction: vi.fn(async (cb: (m: typeof manager) => unknown) => cb(manager)),
  };
  const conversaciones = {
    findOne: vi.fn(async () => (opciones.conversacion === undefined ? null : opciones.conversacion)),
    find: vi.fn(async () => []),
    delete: vi.fn(),
  };
  const mensajes = { count: vi.fn(async () => opciones.usadasHoy ?? 0), find: vi.fn(async () => opciones.historial ?? []) };
  const config = { get: () => ({ preguntasPorDia: 200 }) };
  const service = new AgenteService(dataSource as never, gemini as never, registro as never, { empresaId: () => 7 } as never, conversaciones as never, mensajes as never, config as never);
  return { service, generar, ejecutar, guardados, conversaciones, repoConversaciones, mensajes };
}

describe('AgenteService.preguntar', () => {
  it('ejecuta lo que Gemini pide, le devuelve el resultado y guarda la respuesta', async () => {
    const { service, generar, ejecutar, guardados } = crear();
    generar.mockResolvedValueOnce(pideHerramienta()).mockResolvedValueOnce(responde('Vendiste 100 Bs.'));

    const respuesta = await service.preguntar({ pregunta: '¿Cuanto vendi?' }, usuario);

    expect(ejecutar).toHaveBeenCalledWith('ventas_por_periodo', { desde: '2026-01-01' }, 7, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    const segunda = generar.mock.calls[1][0].contents;
    // La respuesta del modelo vuelve intacta (Gemini 3 exige sus firmas) y despues el resultado.
    expect(segunda[1].parts[0].thoughtSignature).toBe('firma');
    expect(segunda[2].parts[0].functionResponse).toMatchObject({ id: 'c1', name: 'ventas_por_periodo', response: { total_filas: 1 } });
    expect(respuesta).toMatchObject({ idConversacion: 55, texto: 'Vendiste 100 Bs.', tokens: { entrada: 300, salida: 35 } });
    expect(respuesta.herramientas[0]).toMatchObject({ nombre: 'ventas_por_periodo', ok: true });
    expect(guardados.conversaciones[0]).toMatchObject({ idUsuario: 9, titulo: '¿Cuanto vendi?' });
    expect(guardados.mensajes.map((m) => m.rol)).toEqual(['USUARIO', 'ASISTENTE']);
    expect(guardados.mensajes[1]).toMatchObject({ tokensEntrada: 300, tokensSalida: 35, herramientas: [{ nombre: 'ventas_por_periodo', ok: true }] });
    // Lo guardado no incluye los datos consultados.
    expect(JSON.stringify(guardados.mensajes[1].herramientas)).not.toContain('filas');
  });

  it('la configuracion le da las herramientas, razonamiento bajo y un tope de salida', async () => {
    const { service, generar } = crear();
    generar.mockResolvedValueOnce(responde('Hola'));
    await service.preguntar({ pregunta: 'Hola' }, usuario);
    const { config } = generar.mock.calls[0][0];
    expect(config.tools[0].functionDeclarations).toHaveLength(1);
    expect(config.thinkingConfig.thinkingLevel).toBe('LOW');
    expect(config.maxOutputTokens).toBe(2048);
    expect(config.systemInstruction).toContain('Todo numero');
  });

  it('una consulta repetida en la misma pregunta no se ejecuta dos veces', async () => {
    const { service, generar, ejecutar } = crear();
    generar.mockResolvedValueOnce(pideHerramienta()).mockResolvedValueOnce(pideHerramienta()).mockResolvedValueOnce(responde('Listo'));
    const respuesta = await service.preguntar({ pregunta: 'x' }, usuario);
    expect(ejecutar).toHaveBeenCalledTimes(1);
    expect(respuesta.herramientas).toHaveLength(1);
  });

  it('tras el tope de vueltas lo obliga a responder sin herramientas', async () => {
    const { service, generar, ejecutar } = crear();
    let n = 0;
    generar.mockImplementation(async (peticion: { config: { toolConfig?: unknown } }) => (peticion.config.toolConfig ? responde('Con lo que tengo') : pideHerramienta('ventas_por_periodo', { n: n++ })));
    const respuesta = await service.preguntar({ pregunta: 'x' }, usuario);
    expect(ejecutar).toHaveBeenCalledTimes(6);
    expect(generar).toHaveBeenCalledTimes(8);
    expect(generar.mock.calls[7][0].config.toolConfig.functionCallingConfig.mode).toBe('NONE');
    expect(respuesta.texto).toBe('Con lo que tengo');
  });

  it('sin datos cargados no gasta en Gemini', async () => {
    const { service, generar } = crear({ ultimaCarga: null });
    await expect(service.preguntar({ pregunta: 'x' }, usuario)).rejects.toThrow(ConflictException);
    expect(generar).not.toHaveBeenCalled();
  });

  it('al llegar al limite diario responde 429 sin gastar en Gemini', async () => {
    const { service, generar } = crear({ usadasHoy: 200 });
    await expect(service.preguntar({ pregunta: 'x' }, usuario)).rejects.toMatchObject({ status: 429 });
    expect(generar).not.toHaveBeenCalled();
  });

  it('no deja continuar la conversacion de otro usuario', async () => {
    const { service, generar, conversaciones } = crear({ conversacion: null });
    await expect(service.preguntar({ pregunta: 'x', idConversacion: 3 }, usuario)).rejects.toThrow(NotFoundException);
    expect(conversaciones.findOne).toHaveBeenCalledWith({ where: { id: 3, idEmpresa: 7, idUsuario: 9 } });
    expect(generar).not.toHaveBeenCalled();
  });

  it('continua una conversacion con su historial en orden', async () => {
    const historial = [
      { id: 2, rol: 'ASISTENTE' as const, contenido: 'Respuesta' },
      { id: 1, rol: 'USUARIO' as const, contenido: 'Primera' },
    ];
    const { service, generar, guardados, repoConversaciones } = crear({ conversacion: { id: 3 }, historial });
    generar.mockResolvedValueOnce(responde('Segunda respuesta'));
    const respuesta = await service.preguntar({ pregunta: 'Segunda', idConversacion: 3 }, usuario);
    expect(generar.mock.calls[0][0].contents.map((c: { role: string; parts: Array<{ text: string }> }) => [c.role, c.parts[0].text])).toEqual([
      ['user', 'Primera'],
      ['model', 'Respuesta'],
      ['user', 'Segunda'],
    ]);
    expect(respuesta.idConversacion).toBe(3);
    expect(guardados.conversaciones).toHaveLength(0);
    expect(repoConversaciones.update).toHaveBeenCalled();
  });

  it('cuota agotada: 429 con mensaje claro y nada guardado', async () => {
    const { service, generar, guardados } = crear();
    generar.mockRejectedValue(Object.assign(new Error('RESOURCE_EXHAUSTED key=abc'), { status: 429 }));
    const error = await service.preguntar({ pregunta: 'x' }, usuario).catch((e: HttpException) => e);
    expect((error as HttpException).getStatus()).toBe(429);
    expect((error as HttpException).message).not.toContain('abc');
    expect(guardados.mensajes).toHaveLength(0);
  });

  it('con 503 reintenta una vez', async () => {
    const { service, generar } = crear();
    generar.mockRejectedValueOnce(Object.assign(new Error('alta demanda'), { status: 503 })).mockResolvedValueOnce(responde('Ya'));
    await expect(service.preguntar({ pregunta: 'x' }, usuario)).resolves.toMatchObject({ texto: 'Ya' });
    expect(generar).toHaveBeenCalledTimes(2);
  });

  it('una respuesta vacia es un error, no un mensaje en blanco', async () => {
    const { service, generar, guardados } = crear();
    generar.mockResolvedValue({ text: '   ' });
    await expect(service.preguntar({ pregunta: 'x' }, usuario)).rejects.toThrow(ServiceUnavailableException);
    expect(guardados.mensajes).toHaveLength(0);
  });
});

describe('AgenteService conversaciones', () => {
  it('lista solo las del usuario en su empresa', async () => {
    const { service, conversaciones } = crear();
    await service.listarConversaciones(9);
    expect(conversaciones.find).toHaveBeenCalledWith(expect.objectContaining({ where: { idEmpresa: 7, idUsuario: 9 } }));
  });

  it('no borra una ajena', async () => {
    const { service, conversaciones } = crear({ conversacion: null });
    await expect(service.borrarConversacion(3, 9)).rejects.toThrow(NotFoundException);
    expect(conversaciones.delete).not.toHaveBeenCalled();
  });
});
